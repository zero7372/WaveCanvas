async function runInspectorTests(app, check) {
    const doc=app.document,runtime=app.VisualizerRuntime,pane=doc.querySelector('#settings-groups');
    const row=key=>doc.querySelector('[data-property="'+key+'"]'),visible=node=>!node.hidden&&node.dataset.layoutHidden!=='true';
    const collapsible=doc.querySelector('#inspector-spectrum .settings-group');
    const saved=JSON.stringify(app.VisualizerPresets.create('Inspector restore'));
    const nodes=new Map(Array.from(pane.querySelectorAll('[data-property],[data-layout-property]')).map(node=>[node.dataset.property||node.dataset.layoutProperty,node]));
    const setLayout=value=>{const input=doc.querySelector('#layout-layout');input.value=value;input.dispatchEvent(new app.Event('change'));};
    const trace=()=>{
        const styles=[],ctx=app.ctx,stroke=ctx.stroke,fill=ctx.fillRect;
        ctx.stroke=function(...args){styles.push(this.strokeStyle);return stroke.apply(this,args);};
        ctx.fillRect=function(...args){styles.push(this.fillStyle);return fill.apply(this,args);};
        try { app.run(); } finally {ctx.stroke=stroke;ctx.fillRect=fill;}
        return styles;
    };
    try {
        for(const layout of ['circle','square','linear']) {
            setLayout(layout);
            check(['audiocount','barwidth','barheight','barsarc','circleradius','circlearc','userspectrumrotation','reverseright'].every(key=>visible(row(key))===(layout==='circle')), 'Inspector Circle-only controls scoped: '+layout);
            check(['secondcircle','bbassmultiplier','barcircledistance'].every(key=>visible(row(key))===(layout!=='linear')), 'Inspector center shapes/bass shared by Circle and Square: '+layout);
            check(visible(doc.querySelector('[data-position-proxy=spectrumX]'))===(layout==='circle')&&!doc.querySelector('[data-layout-property=positionX]').hidden===(layout!=='circle'), 'Exactly one spectrum position pair per layout: '+layout);
            check(doc.querySelector('[data-layout-property=squareSpectrumLayout]').hidden===(layout!=='square'), 'Inspector Square spectrum selector scoped: '+layout);
            check(doc.querySelector('[data-layout-property=orientation]').hidden===(layout!=='linear'), 'Inspector Linear controls scoped: '+layout);
            check(Array.from(pane.querySelectorAll('[data-property],[data-layout-property]')).every(node=>nodes.get(node.dataset.property||node.dataset.layoutProperty)===node), 'Inspector retains original control nodes: '+layout);
            check(['barcolor','barcolortype','baropacity','beattolerance','userrainbowrotate'].every(key=>row(key).closest('.settings-group').querySelector('summary').textContent==='外觀'&&row(key).closest('#inspector-spectrum')), 'Spectrum appearance section holds the color controls: '+layout);
            app.audioSample.fill(.5);
            runtime.updateProperties({barcolortype:{value:1},barcolor:{value:'0.2 0.4 0.6'},baropacity:{value:100}});
            const normal=trace();runtime.updateProperties({baropacity:{value:40}});const faded=trace();
            check(normal.some(color=>color==='#336699'||color.includes('51, 102, 153')) && faded.some(color=>color.includes('0.4')), 'Common Spectrum opacity affects renderer: '+layout);
            runtime.updateProperties({barcolor:{value:'0.8 0.2 0.1'}});
            check(trace().some(color=>color.includes('204, 51, 26')), 'Common Spectrum color affects renderer: '+layout);
            runtime.updateProperties({barcolortype:{value:2},userrainbowrotate:{value:0}});const rainbow=trace();
            runtime.updateProperties({userrainbowrotate:{value:20}});
            check(JSON.stringify(trace())!==JSON.stringify(rainbow), 'Common Spectrum rainbow mode/offset affects renderer: '+layout);
            runtime.updateProperties({barcolortype:{value:3},beattolerance:{value:0},barcolor:{value:'0.2 0.4 0.6'}});const beat=trace();
            runtime.updateProperties({beattolerance:{value:50},barcolor:{value:'0.2 0.4 0.6'}});
            check(JSON.stringify(trace())!==JSON.stringify(beat), 'Common Spectrum beat threshold affects renderer: '+layout);
        }
        // 每個 Layout 有獨立設定庫，切回原 Layout 才能驗證保留結果。
        const originLayout=runtime.getStandalone().visualizer.layout;runtime.updateProperties({barheight:{value:233},circleradius:{value:83}});
        setLayout('square');runtime.updateStandalone({visualizer:{squareSize:350,squareSpectrumLayout:'foldedDiagonal'}});
        collapsible.open=false;setLayout('linear');runtime.updateStandalone({visualizer:{orientation:'vertical',mirror:'dual'}});const linearRetained=runtime.getStandalone().visualizer.orientation==='vertical';setLayout(originLayout);const originRetained=runtime.getSettings().barheight.value===233&&runtime.getSettings().circleradius.value===83;setLayout('square');
        check(originRetained&&linearRetained&&runtime.getStandalone().visualizer.squareSize===350, 'Layout switches retain Circle/Square/Linear settings');
        check(!collapsible.open, 'Layout switches retain per-section collapse state');collapsible.open=true;
        runtime.updateProperties({circleradius:{value:91}});const preset=JSON.stringify(app.VisualizerPresets.create('Inspector UX'));
        app.VisualizerPresets.reset();app.VisualizerPresets.import(preset);
        check(doc.querySelector('#layout-squareSpectrumLayout').value==='foldedDiagonal'&&runtime.getSettings().circleradius.value===91, 'Inspector preset roundtrip preserves keys and Square layout');
        const legacy=JSON.parse(preset);delete legacy.standalone.visualizer.squareSpectrumLayout;app.VisualizerPresets.import(JSON.stringify(legacy));
        check(runtime.getStandalone().visualizer.squareSpectrumLayout==='foldedDiagonal', 'Inspector old preset uses official Square spectrum without format change');
        runtime.updateProperties({particlestyle:{value:2},particlerainbow:{value:true}});
        check(!row('particlecolor').hidden&&row('particleopacity').hidden&&row('twinkling').hidden, 'Style 2 exposes effective color and hides Style 1-only controls');
        app.VisualizerPresets.reset();
        check(JSON.stringify(runtime.getStandalone())===JSON.stringify(runtime.getStandaloneDefaults()), 'Inspector Reset synchronizes current layout defaults and section');
        check(!pane.querySelector('[data-property] input:disabled')&&!pane.querySelector('[data-layout-property] input:disabled'), 'Inspector contains no disabled debug controls');
        // 共用設定與位置換算
        setLayout('circle');runtime.updateProperties({barcolor:{value:'0 1 0'},bbassmultiplier:{value:33}});setLayout('square');
        check(runtime.getSettings().barcolor.value==='0 1 0'&&runtime.getSettings().bbassmultiplier.value===33, 'Spectrum color and bass reaction carry across layouts');
        setLayout('circle');const proxy=doc.querySelector('#position-spectrumX');proxy.value=75;proxy.dispatchEvent(new app.Event('input'));
        check(runtime.getSettings().eqpositionx.value===480, 'Circle position percent writes the stored pixel offset');
        const proxyRow=proxy.closest('.setting-row');check(proxyRow.querySelector('.restore-default')&&!proxyRow.querySelector('.restore-default').disabled, 'Position percent row offers restore');
        proxyRow.querySelector('.restore-default').click();check(runtime.getSettings().eqpositionx.value===0, 'Position percent restore resets the pixel offset');
        const panes=Array.from(doc.querySelectorAll('#settings-groups > .inspector-tab'));
        check(Array.from(doc.querySelectorAll('#settings-groups .setting-row')).every(node=>node.closest('.inspector-tab')), 'Every control belongs to a layer');
        check(panes.length===7, 'Seven layer panes');
    } finally {app.VisualizerPresets.import(saved);}
}

async function runInspectorTests(app, check) {
    const doc=app.document,runtime=app.VisualizerRuntime,pane=doc.querySelector('#inspector-visualizer');
    const row=key=>doc.querySelector('[data-property="'+key+'"]'),section=key=>pane.querySelector('[data-inspector-section="'+key+'"]');
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
            check(['circle','square','linear'].every(key=>section(key).hidden===(key!==layout)), 'Inspector shows only active layout section: '+layout);
            check(Array.from(pane.children).filter(node=>!node.hidden).map(node=>node.dataset.inspectorSection).join(',')==='layout,spectrum,'+layout+',position,bass,particles,other', 'Inspector section order: '+layout);
            check(['audiocount','barwidth','barheight','barsarc','circleradius','circlearc','userspectrumrotation','reverseright'].every(key=>row(key).hidden===(layout!=='circle')), 'Inspector Circle-only controls scoped: '+layout);
            check(['audiocount','barwidth','barheight','circleradius'].every(key=>row(key).closest('[data-inspector-section]').dataset.inspectorSection==='circle'), 'Circle-only controls remain in Circle section: '+layout);
            check(['secondcircle','cbassmultiplier','bbassmultiplier','barcircledistance'].every(key=>row(key).hidden===(layout==='linear')), 'Inspector center shapes/bass shared by Circle and Square: '+layout);
            check(doc.querySelector('[data-layout-property=squareSpectrumLayout]').hidden===(layout!=='square'), 'Inspector Square spectrum selector scoped: '+layout);
            check(doc.querySelector('[data-layout-property=orientation]').hidden===(layout!=='linear'), 'Inspector Linear controls scoped: '+layout);
            check(Array.from(pane.querySelectorAll('[data-property],[data-layout-property]')).every(node=>nodes.get(node.dataset.property||node.dataset.layoutProperty)===node), 'Inspector retains original control nodes: '+layout);
            check(Array.from(section('spectrum').querySelectorAll('[data-property]')).map(node=>node.dataset.property).sort().join(',')==='barcolor,barcolortype,baropacity,beattolerance,userrainbowrotate', 'Common Spectrum contains only effective color controls: '+layout);
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
        runtime.updateProperties({barheight:{value:233},circleradius:{value:83}});
        setLayout('square');runtime.updateStandalone({visualizer:{squareSize:350,squareSpectrumLayout:'foldedDiagonal'}});
        section('square').open=false;setLayout('linear');runtime.updateStandalone({visualizer:{orientation:'vertical',mirror:'dual'}});setLayout('square');
        check(runtime.getSettings().barheight.value===233&&runtime.getStandalone().visualizer.squareSize===350&&runtime.getStandalone().visualizer.orientation==='vertical', 'Layout switches retain Circle/Square/Linear settings');
        check(!section('square').open, 'Layout switches retain per-section collapse state');
        const preset=JSON.stringify(app.VisualizerPresets.create('Inspector UX'));
        app.VisualizerPresets.reset();app.VisualizerPresets.import(preset);
        check(!section('square').hidden&&doc.querySelector('#layout-squareSpectrumLayout').value==='foldedDiagonal'&&runtime.getSettings().circleradius.value===83, 'Inspector preset roundtrip preserves keys and Square layout');
        const legacy=JSON.parse(preset);delete legacy.standalone.visualizer.squareSpectrumLayout;app.VisualizerPresets.import(JSON.stringify(legacy));
        check(runtime.getStandalone().visualizer.squareSpectrumLayout==='symmetric', 'Inspector old preset defaults Square spectrum without format change');
        runtime.updateProperties({particlestyle:{value:2},particlerainbow:{value:true}});
        check(!row('particlecolor').hidden&&row('particleopacity').hidden&&row('twinkling').hidden, 'Style 2 exposes effective color and hides Style 1-only controls');
        app.VisualizerPresets.reset();
        check(!section('circle').hidden&&JSON.stringify(runtime.getStandalone())===JSON.stringify(runtime.getStandaloneDefaults()), 'Inspector Reset synchronizes defaults and Circle section');
        check(!pane.querySelector('[data-property] input:disabled')&&!pane.querySelector('[data-layout-property] input:disabled'), 'Inspector contains no disabled debug controls');
    } finally {app.VisualizerPresets.import(saved);}
}

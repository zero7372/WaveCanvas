async function runGeometryTests(app, we, check) {
    const doc = app.document, runtime = app.VisualizerRuntime;
    const frame = document.querySelector('#standalone');
    const wait = () => new Promise(resolve => setTimeout(resolve, 100));
    const input = (key, value) => {
        const node = doc.querySelector('#layout-' + key);
        if (node.type === 'checkbox') node.checked = value; else node.value = value;
        node.dispatchEvent(new app.Event(node.type === 'range' ? 'input' : 'change'));
    };
    function stageCheck(label) {
        const rect = doc.querySelector('#stage').getBoundingClientRect();
        const container = doc.querySelector('#preview-container').getBoundingClientRect();
        check(Math.abs(rect.width / rect.height - 16 / 9) < 0.001, label + ': fixed 16:9');
        check(rect.left >= container.left - 1 && rect.top >= container.top - 1 && rect.right <= container.right + 1 && rect.bottom <= container.bottom + 1, label + ': contained');
        check(app.canvas.width === 1920 && app.canvas.height === 1080, label + ': canonical backing resolution');
        const mapped = app.VisualizerStage.toStage(rect.left + rect.width / 2, rect.top + rect.height / 2);
        check(Math.abs(mapped.x - 960) < 0.001 && Math.abs(mapped.y - 540) < 0.001, label + ': 1920x1080 coordinates');
    }
    const oldStyle = frame.getAttribute('style');
    const open = !doc.querySelector('#settings-panel').hidden;
    try {
        check(doc.querySelectorAll('[data-layout-property]').length === Object.keys(app.VisualizerLayoutSettings.properties).length, 'All Standalone geometry controls generated');
        for (const [width, height] of [[1200, 800], [720, 420], [390, 720], [640, 230]]) {
            frame.style.width = width + 'px'; frame.style.height = height + 'px';
            for (const panelOpen of [false, true]) {
                if (!doc.querySelector('#settings-panel').hidden !== panelOpen) doc.querySelector('#settings-toggle').click();
                await wait(); stageCheck(width + 'x' + height + (panelOpen ? ' open' : ' closed'));
            }
        }
        input('layout', 'square'); input('squareSize', '310'); input('rotation', '25');
        check(runtime.getStandalone().visualizer.layout === 'square' && runtime.getStandalone().visualizer.squareSize === 310 && app.VisualizerGeometry.active(), 'Square UI -> unified Standalone settings');
        app.audioSample.fill(0.1); app.run();
        const squareConfig = runtime.getStandalone().visualizer;
        const probe = Array(128).fill(0); probe[1] = .7; probe[13] = .3; probe[45] = .1;
        const squareGeometry = app.VisualizerGeometry.build(probe, squareConfig);
        const n = squareGeometry.perSide;
        check(squareGeometry.bars.length === 4*n && [1,2,3].every(side=>squareGeometry.bars.slice(side*n,(side+1)*n).every((bar,i)=>bar.length===squareGeometry.bars[i].length)), 'Square shares the entire spectrum equally across all four edges');
        check(squareGeometry.bars.slice(0,n).every((bar,i)=>Math.abs(bar.x+squareGeometry.bars[n-1-i].x)<1e-8 && bar.length===squareGeometry.bars[n-1-i].length), 'Square mirrors each edge around its center');
        check(doc.querySelector('[data-layout-property=mirror]').hidden, 'Square symmetry is intrinsic; Linear mirror options are hidden');
        const squareImage = app.canvas.toDataURL();
        input('direction', 'inward'); app.run();
        check(app.canvas.toDataURL() !== squareImage, 'Square inward changes rendered geometry');
        check(!doc.querySelector('[data-layout-property=squareSpectrumLayout]').hidden, 'Square spectrum selector is visible only for Square');
        for (const mode of ['symmetric', 'topBassMirror', 'foldedDiagonal']) {
            input('squareSpectrumLayout', mode); input('direction', 'outward');
            const config = runtime.getStandalone().visualizer;
            check(config.squareSpectrumLayout === mode, 'Square spectrum UI -> runtime: ' + mode);
            const geometry = app.VisualizerGeometry.build(probe, config), size = geometry.perSide;
            const side = (s, i) => geometry.bars[s*size+i];
            const valid = Array.from({length:size},(_,i)=>i).every(i => mode === 'symmetric'
                ? [1,2,3].every(s=>side(s,i).group===side(0,i).group) && side(0,i).group===side(0,size-1-i).group
                : mode === 'topBassMirror' ? side(0,i).group===side(0,size-1-i).group && side(1,i).group===side(3,size-1-i).group
                : side(0,i).group===side(2,size-1-i).group && side(1,i).group===side(3,size-1-i).group);
            check(valid && geometry.bars.length===4*size, 'Square spectrum symmetry/count: ' + mode);
            app.run(); const image = app.canvas.toDataURL();
            input('rotation','70'); app.run();
            check(app.canvas.toDataURL()!==image, 'Square spectrum rotation renders: ' + mode);
            const preset = app.VisualizerPresets.create('Square ' + mode);
            check(preset.version===1 && preset.standalone.visualizer.squareSpectrumLayout===mode, 'Square spectrum preset export version 1: ' + mode);
            app.VisualizerPresets.reset(); app.VisualizerPresets.import(JSON.stringify(preset));
            check(doc.querySelector('#layout-squareSpectrumLayout').value===mode, 'Square spectrum preset import -> UI: ' + mode);
            input('rotation','25');
        }
        const legacyPreset = app.VisualizerPresets.create('Legacy square');
        delete legacyPreset.standalone.visualizer.squareSpectrumLayout;
        app.VisualizerPresets.import(JSON.stringify(legacyPreset));
        check(runtime.getStandalone().visualizer.squareSpectrumLayout==='symmetric', 'Legacy Square preset defaults missing spectrum layout to Symmetric');
        input('layout', 'linear'); input('orientation', 'horizontal'); input('barCount', '16');
        check(doc.querySelector('[data-layout-property=squareSpectrumLayout]').hidden, 'Linear hides Square spectrum selector');
        app.run(); const horizontalImage = app.canvas.toDataURL();
        input('orientation', 'vertical'); app.run();
        check(app.canvas.toDataURL() !== horizontalImage, 'Linear horizontal / vertical rendering');
        for (const mirror of ['none', 'center', 'dual']) {
            input('mirror', mirror); app.run();
            check(runtime.getStandalone().visualizer.mirror === mirror, 'Mirror mode ' + mirror + ' renders');
        }
        input('reverse', true); input('positionX', '35'); input('positionY', '60'); input('anchor', 'end'); input('amplitudeDirection', 'both');
        const expected = JSON.stringify(runtime.getStandalone().visualizer);
        const preset = JSON.stringify(app.VisualizerPresets.create('Geometry'));
        app.VisualizerPresets.reset(); app.VisualizerPresets.import(preset);
        check(JSON.stringify(runtime.getStandalone().visualizer) === expected, 'Preset preserves complete geometry settings');
        check(doc.querySelector('#layout-positionX').value === '35' && doc.querySelector('#layout-reverse').checked, 'Imported geometry state -> UI');
        frame.style.width = '1100px'; frame.style.height = '700px'; await wait();
        check(JSON.stringify(runtime.getStandalone().visualizer) === expected, 'Resize preserves canonical geometry settings');
        input('layout', 'circle');
        check(!app.VisualizerGeometry.active(), 'Circle uses original radial renderer');
        we.VisualizerRuntime.updateStandalone({ visualizer: { layout: 'square' } });
        check(!we.VisualizerGeometry.active(), 'WE retains original Circle renderer');
        app.VisualizerPresets.reset();
        check(JSON.stringify(runtime.getStandalone()) === JSON.stringify(runtime.getStandaloneDefaults()), 'Reset includes layout defaults');
    } finally {
        if (oldStyle === null) frame.removeAttribute('style'); else frame.setAttribute('style', oldStyle);
        if (!doc.querySelector('#settings-panel').hidden !== open) doc.querySelector('#settings-toggle').click();
        app.VisualizerPresets.reset();
    }
}

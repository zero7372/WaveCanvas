(function () {
    'use strict';
    const runtime = window.VisualizerRuntime;
    if (runtime.mode !== 'standalone') return;
    const controls = [];
    // Enhance existing schema-generated controls; their input handlers and DOM identity stay intact.
    for (const pair of document.querySelectorAll('#settings-panel .numeric-pair')) {
        const row = pair.closest('.setting-row');
        let scope, key;
        if (row.dataset.positionProxy) ({ scope, key } = window.WaveCanvasLayerStructure.proxies[row.dataset.positionProxy]);
        else if (row.dataset.property) { scope = 'properties'; key = row.dataset.property; }
        else if (row.dataset.layoutProperty) { scope = 'visualizer'; key = row.dataset.layoutProperty; }
        else if (row.dataset.backgroundProperty) { scope = 'background'; key = row.dataset.backgroundProperty; }
        else if (row.dataset.textProperty) { scope = 'text'; key = row.dataset.textProperty; }
        else if (row.dataset.lyricsProperty) { scope = 'lyrics'; key = row.dataset.lyricsProperty; }
        else if (pair.querySelector('#setting-inputGain')) { scope = 'inputGain'; key = 'inputGain'; }
        else continue;
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'restore-default'; button.textContent = '↺';
        button.title = '恢復預設值'; button.dataset.restoreScope = scope; button.dataset.restoreKey = key;
        window.WaveCanvasI18nDom.attr(button, 'aria-label', '{field}：恢復預設值', { field: window.WaveCanvasI18n.msg(row.querySelector('label')?.textContent || key) });
        button.addEventListener('click', () => runtime.restoreDefault(scope, key));
        pair.classList.add('has-restore'); pair.append(button);
        controls.push({ scope, key, button, row });
    }
    runtime.subscribe((properties, standalone) => {
        const propertyDefaults = runtime.getDefaults();
        const defaults = runtime.getStandaloneDefaults();
        for (const { scope, key, button, row } of controls) {
            const current = scope === 'properties' ? properties[key].value : scope === 'inputGain' ? standalone.inputGain : standalone[scope][key];
            const baseline = scope === 'properties' ? propertyDefaults[key].value : scope === 'inputGain' ? defaults.inputGain : defaults[scope][key];
            button.disabled = window.VisualizerFactoryDefaults.equal(current, baseline);
            window.WaveCanvasI18nDom.attr(button, 'aria-label', '{field}：恢復預設值', { field: window.WaveCanvasI18n.msg(row.querySelector('label')?.textContent || key) });
        }
    });
}());

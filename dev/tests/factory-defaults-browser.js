document.querySelector('#run').addEventListener('click', async function () {
    this.disabled = true;
    const output = document.querySelector('#results'), frame = document.querySelector('#app');
    let passes = 0, failures = 0;
    const check = (ok, label) => { output.textContent += '\n' + (ok ? 'PASS ' : 'FAIL ') + label; ok ? passes++ : failures++; };
    const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    output.textContent = 'Running';
    try {
        await new Promise(resolve => { frame.onload = resolve; frame.src = '../../app/index.html?factory-default-tests'; });
        const app = frame.contentWindow, doc = app.document, runtime = app.VisualizerRuntime, errors = [];
        app.addEventListener('error', event => errors.push(event.message));
        app.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
        check(Boolean(runtime && app.VisualizerFactoryDefaults), 'Factory module and runtime boot without errors');
        doc.querySelector('#new-project').click();
        check(runtime.getSettings().circleradius.value === 160 && runtime.getSettings().barheight.value === 230, 'New editor initializes supplied Circle factory values');
        check(runtime.getStandalone().inputGain === 3, 'Shared Input Gain uses supplied 3x factory value');
        const numeric = [...doc.querySelectorAll('#settings-panel .numeric-pair')];
        check(numeric.length > 70 && numeric.every(pair => pair.querySelectorAll('.restore-default').length === 1), 'Every numeric settings pair has exactly one compact restore button (' + numeric.length + ')');
        check([...doc.querySelectorAll('.restore-default')].every(button => button.title === '恢復預設值' && button.getAttribute('aria-label')), 'Restore controls have Chinese tooltips and accessible labels');
        check([...doc.querySelectorAll('#settings-panel .setting-row')].filter(row => row.querySelector('select,input[type=checkbox],input[type=color],input[type=file],input[type=text]')).every(row => !row.querySelector('.restore-default')), 'Non-numeric controls do not have restore buttons');
        const button = (scope, key) => doc.querySelector('[data-restore-scope="' + scope + '"][data-restore-key="' + key + '"]');
        const layout = value => { const node = doc.querySelector('#layout-layout'); node.value = value; node.dispatchEvent(new app.Event('change')); };
        const numericInput = (selector, value) => { const node = doc.querySelector(selector); node.value = value; node.dispatchEvent(new app.Event('input')); };
        check(button('properties','circleradius').disabled, 'Circle factory-equal values start dimmed/disabled');
        numericInput('#setting-circleradius',181);
        check(!button('properties','circleradius').disabled && runtime.getSettings().circleradius.value === 181, 'Numeric input goes through runtime and enables restore');
        layout('square');
        check(runtime.getStandalone().visualizer.squareSpectrumLayout === 'foldedDiagonal' && runtime.getStandalone().visualizer.rotation === 90, 'Square first-use mapping and rotation match supplied JSON');
        numericInput('#layout-squareSize',350); numericInput('#layout-positionX',42);
        layout('linear');
        const initial = runtime.getStandalone().visualizer;
        check(initial.positionY === 100 && initial.width === 1920 && initial.height === 400, 'Linear factory position and size match supplied JSON');
        check(initial.coverShape === 'circle' && initial.coverRotationSpeed === 0 && doc.querySelector('#layout-coverShape').value === 'circle', 'Linear Circle artwork and zero RPM are exact factory values');
        for (const [key, value] of [['coverX',72],['coverY',74],['coverSize',44],['coverRotationSpeed',6]]) {
            numericInput('#layout-' + key, value);
            const before = runtime.getStandalone();
            check(!button('visualizer',key).disabled, key + ' restore activates after edit');
            button('visualizer',key).click();
            before.visualizer[key] = runtime.getStandaloneDefaults().visualizer[key];
            check(equal(runtime.getStandalone(),before) && button('visualizer',key).disabled, key + ' restores only itself and updates indicator');
        }
        numericInput('#layout-width',1650); numericInput('#layout-positionY',96);
        layout('circle');
        check(runtime.getSettings().circleradius.value === 181, 'Circle edit survives Square/Linear roundtrip');
        button('properties','circleradius').click();
        check(runtime.getSettings().circleradius.value === 160 && doc.querySelector('#setting-circleradius').value === '160', 'Circle context restore returns to 160 and syncs both inputs');
        layout('square');
        check(runtime.getStandalone().visualizer.squareSize === 350 && runtime.getStandalone().visualizer.positionX === 42, 'Square edits survive layout roundtrip');
        layout('linear');
        check(runtime.getStandalone().visualizer.width === 1650 && runtime.getStandalone().visualizer.positionY === 96, 'Linear edits survive layout roundtrip');
        const factory = JSON.stringify(app.VisualizerFactoryDefaults.get('linear'));
        app.VisualizerPresets.import(JSON.stringify({format:'audio-visualizer-preset',version:1,name:'Override',properties:{},standalone:{visualizer:{layout:'linear',coverX:79,coverY:81}}}));
        button('visualizer','coverX').click();
        check(runtime.getStandalone().visualizer.coverX === 50 && runtime.getStandalone().visualizer.coverY === 81, 'Preset value is runtime-only; single restore returns to factory');
        check(JSON.stringify(app.VisualizerFactoryDefaults.get('linear')) === factory, 'Preset import leaves factory snapshot unchanged');
        runtime.updateStandalone({visualizer:{coverSize:30 + 1e-9}});
        check(button('visualizer','coverSize').disabled, 'Float tolerance avoids false dirty indicators');
        doc.querySelector('#reset-defaults').click();
        check(runtime.getStandalone().visualizer.layout === 'linear' && equal(runtime.getStandalone(),runtime.getStandaloneDefaults()), 'Global reset stays Linear and applies complete Linear factory snapshot');
        check(doc.querySelector('#settings-status').textContent.includes('3×'), 'Reset status reports the actual official Input Gain');
        app.VisualizerPresets.import(JSON.stringify({format:'audio-visualizer-preset',version:1,properties:{},standalone:{visualizer:{layout:'square'}}}));
        check(runtime.getStandalone().visualizer.squareSpectrumLayout === 'foldedDiagonal', 'Old partial Square preset falls back to new official Square defaults');
        const before = JSON.stringify(runtime.getStandalone());
        try { app.VisualizerPresets.import('{broken'); } catch {}
        check(before === JSON.stringify(runtime.getStandalone()), 'Corrupted preset does not change runtime');
        for (const value of ['circle','square','linear']) { layout(value); await new Promise(resolve => setTimeout(resolve,120)); }
        check(errors.length === 0, 'All three render paths execute without browser errors');
        layout('linear');
        doc.querySelector('[data-inspector-section="linear"]').open = true;
    } catch (error) { check(false, error.stack || error.message); }
    output.textContent += '\nDONE ' + passes + ' passed / ' + failures + ' failed';
    this.disabled = false;
});

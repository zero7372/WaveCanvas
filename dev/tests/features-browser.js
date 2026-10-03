async function runFeatureTests(app, we, check) {
    const runtime = app.VisualizerRuntime;
    const doc = app.document;
    const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
    const imageFile = async (type, name, width = 240, height = 120) => {
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#284e69'; ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#72d6bf'; ctx.fillRect(width / 3, 0, width / 3, height);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, type));
        if (!blob || blob.type !== type) throw new Error('Image fixture encoder unavailable: ' + type);
        return new app.File([blob], name, { type });
    };
    const select = (key, files) => {
        const input = doc.querySelector('#setting-' + key);
        const transfer = new app.DataTransfer();
        for (const file of files) transfer.items.add(file);
        input.files = transfer.files; input.dispatchEvent(new app.Event('change'));
    };
    const until = async predicate => {
        for (let i = 0; i < 100; i++) { if (predicate()) return; await wait(20); }
        throw new Error('Feature test timeout');
    };
    const decoded = new Map();
    const revoked = [];
    const originalDecode = app.Image.prototype.decode;
    const originalRevoke = app.URL.revokeObjectURL.bind(app.URL);
    app.Image.prototype.decode = function () { decoded.set(this.src, (decoded.get(this.src) || 0) + 1); return originalDecode.call(this); };
    app.URL.revokeObjectURL = url => { revoked.push(url); originalRevoke(url); };
    try {
        check(doc.querySelectorAll('[data-property]').length === 54, 'UI exposes 54 active property definitions; retired keys stay internal');
        check(doc.querySelectorAll('[data-metadata]').length === 11, 'UI removes Clock metadata and keeps active section metadata');
        check(we.document.querySelector('#standalone-chrome').hidden && we.document.querySelector('#settings-panel').hidden, 'WE hides all Standalone chrome and settings');
        if (doc.querySelector('#settings-panel').hidden) doc.querySelector('#settings-toggle').click();
        await wait(60);
        const stage = doc.querySelector('#stage').getBoundingClientRect();
        const panel = doc.querySelector('#settings-panel').getBoundingClientRect();
        check(stage.right <= panel.left + 1 || stage.bottom <= panel.top + 1, 'Panel docks outside visualizer area');
        check(app.canvas.width === 1920 && app.canvas.height === 1080 && Math.abs(stage.width / stage.height - 16 / 9) < 0.001, 'Docked panel keeps canonical 16:9 canvas');
        const checkbox = doc.querySelector('#setting-noise'); checkbox.checked = false; checkbox.dispatchEvent(new app.Event('change'));
        check(runtime.getSettings().noise.value === false && app.noiseOption === false, 'Checkbox -> unified property -> visualizer');
        const slider = doc.querySelector('#setting-resposive'); slider.value = '44'; slider.dispatchEvent(new app.Event('input'));
        check(runtime.getSettings().resposive.value === 44 && app.normaliseReposiveness === 0.44, 'Slider -> unified property -> visualizer');
        const color = doc.querySelector('#setting-barcolor'); color.value = '#336699'; color.dispatchEvent(new app.Event('input'));
        check(runtime.getSettings().barcolor.value === '0.2 0.4 0.6', 'Color converts hex to WE RGB float');
        const combo = doc.querySelector('#setting-barcolortype'); combo.value = '2'; combo.dispatchEvent(new app.Event('change'));
        check(runtime.getSettings().barcolortype.value === 2 && app.RainBow, 'Combo preserves original option values');
        check(doc.querySelector('[data-property=barcolor]').hidden, 'Schema conditions update dependent controls');
        runtime.updateProperties({ resposive: { value: 61 }, barcolortype: { value: 1 }, circlecolor: { value: '0.1 0.2 0.3' } });
        check(slider.value === '61' && doc.querySelector('[data-property=resposive] input[type=number]').value === '61', 'Runtime state synchronizes range and numeric input');
        check(doc.querySelector('#setting-circlecolor').value === '#1a334d' && !color.disabled, 'Runtime state synchronizes color and condition');
        check(['schemecolor','blurvalue','blurclkvalue','blurtxtvalue','showclock','showtext','textfont','clockfont','backgroundvideonumber'].every(key => !doc.querySelector('[data-property=' + key + ']')), 'Retired properties are absent from UI');

        const png = await imageFile('image/png', 'cover.png');
        const jpg = await imageFile('image/jpeg', 'cover.jpg');
        const webp = await imageFile('image/webp', 'cover.webp');
        for (const file of [png, jpg, webp]) {
            const old = runtime.getSettings().logoimage.value;
            select('logoimage', [file]);
            await until(() => app.VisualizerFiles.getName('logoimage') === file.name && app.VisualizerImages.getLogo());
            const url = runtime.getSettings().logoimage.value;
            const logo = app.VisualizerImages.getLogo();
            check(logo.naturalWidth === 240 && logo.naturalHeight === 120, 'Cover decodes non-square ' + file.type);
            await wait(80);
            check(decoded.get(url) === 1, 'Cover caches one decode across frames: ' + file.name);
            if (old) check(revoked.includes(old), 'Cover replacement revokes prior URL: ' + file.name);
        }
        const retained = runtime.getSettings().logoimage.value;
        select('logoimage', []);
        check(runtime.getSettings().logoimage.value === retained, 'Cancel selection retains current Cover');
        select('logoimage', [new app.File(['broken'], 'bad.png', { type: 'image/png' })]);
        await until(() => doc.querySelector('#cover-status').textContent.includes('無法載入'));
        check(runtime.getSettings().logoimage.value === retained && app.VisualizerImages.getLogo(), 'Bad Cover retains previous decoded image');
        const rapid = await Promise.all([app.VisualizerFiles.select('logoimage', [png]), app.VisualizerFiles.select('logoimage', [webp])]);
        check(rapid[0] === false && rapid[1] === true && app.VisualizerFiles.getName('logoimage') === 'cover.webp', 'Rapid changes commit only the latest Cover');
        const newest = runtime.getSettings().logoimage.value;
        doc.querySelector('[data-property=logoimage] .quiet-button').click();
        check(revoked.includes(newest) && runtime.getSettings().logoimage.value === '' && !app.VisualizerImages.getLogo(), 'Clear Cover revokes URL and clears visual cache');
        await app.VisualizerFiles.select('logoimage', [png]);
        await app.VisualizerFiles.select('backgroundimage', [jpg]);
        runtime.updateProperties({ backgroundsource: { value: 2 } });
        check(doc.querySelector('#bgimg').style.backgroundImage.includes(runtime.getSettings().backgroundimage.value), 'Background file uses original image property');
        await app.VisualizerFiles.select('backgroundimagef', [webp]);
        check(doc.querySelector('#overlay').style.backgroundImage.includes(runtime.getSettings().backgroundimagef.value), 'Overlay file uses original image property');
        runtime.updateProperties({ backgroundsource: { value: 3 } });
        check(!doc.querySelector('#bgimg1') && runtime.getSettings().backgroundsource.value === 2, 'Retired rotation falls back to a single image');

        const weURL = URL.createObjectURL(png);
        we.wallpaperPropertyListener.applyUserProperties({ logoimage: { value: weURL } });
        await until(() => we.VisualizerImages.getLogo());
        check(we.VisualizerImages.getLogo().naturalWidth === 240, 'WE logoimage uses the same cached drawing path');
        we.wallpaperPropertyListener.applyUserProperties({ logoimage: { value: '' } });
        URL.revokeObjectURL(weURL);

        runtime.updateProperties({ normalize: { value: false }, noise: { value: false }, resposive: { value: 100 } });
        const spectrum = Array.from({ length: 128 }, (_, index) => index === 12 ? 0.4 : index === 30 ? 0.1 : 0);
        for (const gain of [0.5, 1, 2]) {
            const number = doc.querySelector('[aria-label="輸入增益數值"]');
            number.value = gain; number.dispatchEvent(new app.Event('change'));
            runtime.deliverLocalAudio(spectrum);
            check(Math.abs(app.audioSample[12] - 0.4 * gain) < 1e-12 && Math.abs(app.audioSample[30] - 0.1 * gain) < 1e-12,
                'Input Gain ' + gain + ' changes only amplitude');
            check(app.audioSample.slice(0, 64).indexOf(Math.max(...app.audioSample.slice(0, 64))) === 12, 'Input Gain ' + gain + ' preserves frequency index');
        }
        const preset = app.VisualizerPresets.create('Feature preset');
        check(Object.keys(preset.properties).length === 54 && preset.standalone.inputGain === 2, 'Preset contains 54 active properties plus Standalone Input Gain and Song Info');
        check(!JSON.stringify(preset).includes('blob:') && ['logoimage', 'backgroundimage', 'backgroundimagef'].every(key => preset.properties[key].value === ''), 'Preset excludes URLs and all selected file resources');
        doc.querySelector('#export-preset').click();
        const exportedText = doc.querySelector('#preset-json').value;
        const exportedUI = JSON.parse(exportedText);
        check(exportedUI.format === 'audio-visualizer-preset' && Object.keys(exportedUI.properties).length === 54 && exportedUI.standalone.inputGain === 2,
            'Export button generates complete JSON payload');
        check(doc.querySelector('#preset-download').download.endsWith('.json') && doc.querySelector('#preset-download').href.startsWith('blob:'),
            'Export button exposes downloadable JSON link and filename');
        app.VisualizerPresets.import(JSON.stringify(preset));
        check(app.VisualizerFiles.getName('logoimage') === '' && !app.VisualizerImages.getLogo(), 'Preset import clears and revokes selected image resources');
        const partial = { format: 'audio-visualizer-preset', version: 1, properties: { barheight: 90000, noise: false, unknown: 12 }, standalone: { inputGain: 90 } };
        app.VisualizerPresets.import(JSON.stringify(partial));
        check(runtime.getSettings().barheight.value === 3000 && runtime.getStandalone().inputGain === 4 && runtime.getSettings().circleradius.value === 64, 'Preset missing fields default; numeric values clamp; unknown fields ignored');
        check(doc.querySelector('#setting-barheight').value === '3000' && doc.querySelector('#setting-inputGain').value === '4', 'Imported preset synchronizes UI');
        const before = JSON.stringify(runtime.getSettings());
        let rejected = false;
        try { app.VisualizerPresets.import('{bad json'); } catch { rejected = true; }
        check(rejected && JSON.stringify(runtime.getSettings()) === before, 'Corrupt preset rejection is atomic');
        const importInput = doc.querySelector('#import-preset');
        const sendPreset = (text, name) => {
            const files = new app.DataTransfer(); files.items.add(new app.File([text], name, { type: 'application/json' }));
            importInput.files = files.files; importInput.dispatchEvent(new app.Event('change'));
        };
        sendPreset(exportedText, 'roundtrip.json');
        await until(() => runtime.getStandalone().inputGain === 2);
        check(doc.querySelector('#settings-status').textContent.includes('預設組已載入'), 'Import file UI loads the exported JSON payload');
        sendPreset('{bad json', 'broken.json');
        await until(() => doc.querySelector('#settings-status').textContent.includes('損壞'));
        check(runtime.getStandalone().inputGain === 2, 'Import file UI reports corrupt JSON without changing current settings');
        doc.querySelector('#reset-defaults').click();
        check(JSON.stringify(runtime.getSettings()) === JSON.stringify(runtime.getDefaults()) && runtime.getStandalone().inputGain === 1, 'Reset restores all current defaults and Input Gain 1');
        check(doc.querySelector('#setting-noise').checked && doc.querySelector('#setting-resposive').value === '33', 'Reset UI matches runtime state');
        check(new Set(revoked).size === revoked.length, 'Owned image URLs are revoked exactly once');
        runtime.updateProperties({backgroundsource:{value:2}});
        check(doc.querySelectorAll('[data-background-property]').length===13, 'Background generates all schema controls');
        const x = doc.querySelector('#background-offsetX'); x.value=240; x.dispatchEvent(new app.Event('input'));
        runtime.updateStandalone({background:{offsetY:-120,opacity:.4,blur:18,backingColor:'#123456'}});
        const backgroundStyle=app.getComputedStyle(doc.querySelector('#bgimg'));
        check(Math.abs(new app.DOMMatrix(doc.querySelector('#bgimg').style.transform).m41 - 240) <= 18.001 && Math.abs(new app.DOMMatrix(doc.querySelector('#bgimg').style.transform).m42 + 120) <= 8.101, 'Background position uses canonical pixel offsets');
        check(backgroundStyle.opacity==='0.4' && backgroundStyle.filter==='blur(18px)', 'Background opacity and blur apply to image only');
        check(app.getComputedStyle(doc.querySelector('#stage')).backgroundColor==='rgb(18, 52, 86)', 'Background underlay has independent color');
        runtime.updateProperties({imageoptions:{value:3}});
        check(Math.abs(new app.DOMMatrix(doc.querySelector('#bgimg').style.transform).m41 - 240) <= 18.001 && Math.abs(new app.DOMMatrix(doc.querySelector('#bgimg').style.transform).m42 + 120) <= 8.101, 'Original background sizing update preserves offsets');
        check(doc.querySelector('#background-blur').value==='18', 'Background runtime state synchronizes UI');
        const backgroundPreset=app.VisualizerPresets.create('Background');
        app.VisualizerPresets.reset(); app.VisualizerPresets.import(JSON.stringify(backgroundPreset));
        check(runtime.getStandalone().background.offsetX===240 && runtime.getStandalone().background.opacity===.4, 'Background preset roundtrip');
        runtime.updateProperties({backgroundsource:{value:1}});
        check(doc.querySelector('[data-background-property=offsetX]').hidden && doc.querySelector('#stage').style.backgroundColor==='', 'Image settings deactivate in other background modes');
        app.VisualizerPresets.reset();
        check(runtime.getStandalone().background.backingColor==='#000000' && doc.querySelector('#bgimg').style.opacity==='1', 'Background reset restores black backing and opaque image');
    } finally {
        app.Image.prototype.decode = originalDecode;
        app.URL.revokeObjectURL = originalRevoke;
    }
}

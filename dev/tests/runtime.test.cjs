const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..', 'app');
const crypto = require('node:crypto');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'project.json'), 'utf8')).general.properties;

test('Standalone background settings clamp, preset roundtrip and reject atomically', () => {
    const {sandbox: app,load} = environment(); load('presets.js');
    app.VisualizerRuntime.updateStandalone({background:{offsetX:240,offsetY:-120,opacity:.4,blur:18}});
    const preset=app.VisualizerPresets.create('Background');
    app.VisualizerPresets.reset(); app.VisualizerPresets.import(JSON.stringify(preset));
    assert.equal(app.VisualizerRuntime.getStandalone().background.offsetX,240);
    preset.standalone.background={offsetX:10000,offsetY:-10000,opacity:4,blur:1000,unknown:1};
    const parsed=app.VisualizerPresets.parse(JSON.stringify(preset)).standalone.background;
    assert.equal(parsed.offsetX,1920); assert.equal(parsed.offsetY,-1080); assert.equal(parsed.opacity,1); assert.equal(parsed.blur,80);
    const before=JSON.stringify(app.VisualizerRuntime.getStandalone());
    assert.throws(()=>app.VisualizerRuntime.updateStandalone({inputGain:2,background:{blur:NaN}}));
    assert.throws(()=>app.VisualizerRuntime.updateStandalone({background:{backingColor:'red'}}));
    assert.equal(JSON.stringify(app.VisualizerRuntime.getStandalone()),before);
    delete preset.standalone.background;
    assert.equal(app.VisualizerPresets.parse(JSON.stringify(preset)).standalone.background.backingColor,'#000000');
    const we=environment(true).sandbox;
    we.VisualizerRuntime.updateStandalone({background:{opacity:0}});
    assert.equal(we.VisualizerRuntime.getStandalone().background.opacity,1);
});

function environment(we = false) {
    const elements = new Map();
    const callbacks = [];
    const calls = [];
    const ctx = new Proxy({}, { get(target, key) { return key in target ? target[key] : (...args) => {
        for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value), key + ' received NaN');
        if (key === 'measureText') return { width: 50 };
    }; }});
    const sandbox = { console, URL, prompt() { return ''; }, setInterval() {}, addEventListener() {},
        ResizeObserver: class { observe() {} }, document: { body: { classList: { add() {} } }, querySelector(selector) {
        if (!elements.has(selector)) elements.set(selector, {
            style: {}, scrollWidth: 1280, scrollHeight: 720, clientWidth: 1280, clientHeight: 720,
            getContext() { return ctx; }, setAttribute(key, value) { this[key] = value; },
            getAttribute(key) { return this[key]; }, removeAttribute(key) { delete this[key]; },
            pause() {}, load() {}, play() { return Promise.resolve(); }
        });
        return elements.get(selector);
    } } };
    sandbox.window = sandbox;
    sandbox.requestAnimationFrame = callback => { callbacks.push(callback); return callbacks.length; };
    if (we) {
        sandbox.wallpaperRegisterAudioListener = callback => { calls.push('register'); sandbox.weAudio = callback; };
        sandbox.wallpaperRequestRandomFileForProperty = (key, callback) => { calls.push(key); callback(key, 'file:///sample.jpg'); };
    }
    vm.createContext(sandbox);
    function load(file) { vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file }); }
    load('property-schema.js');
    load('layout-schema.js');
    load('system-fonts.js');
    load('property-compatibility.js');
    load('song-info-schema.js');
    load('lyrics-schema.js');
    load('background-schema.js');
    load('inspector-policy.js');
    load('factory-defaults-data.js');
    load('factory-layout-defaults.js');
    load('runtime-adapter.js');
    load('preview-stage.js');
    load('audio-adapter.js');
    load('image-cache.js');
    load('visualizer-geometry.js');
    return { sandbox, load, calls, elements, callbacks };
}

test('generated schema includes every property and metadata', () => {
    const { sandbox } = environment();
    assert.deepEqual(JSON.parse(JSON.stringify(sandbox.VisualizerRuntime.getSchema().properties)), schema);
    assert.equal(Object.keys(sandbox.VisualizerRuntime.getSettings()).length, 86);
    for (const [key, property] of Object.entries(schema)) {
        if (property.type !== 'text') assert.equal(sandbox.VisualizerRuntime.getSettings()[key].value, sandbox.VisualizerRuntime.getDefaults()[key].value);
    }
});

test('standalone renders with defaults and no WE API', () => {
    const { sandbox, load, calls } = environment();
    load('main.js');
    sandbox.run();
    assert.equal(sandbox.audioSample.length, 128);
    assert.ok(sandbox.audioSample.every(value => value === 0));
    assert.equal(sandbox.normaliseReposiveness, 0.33);
    assert.equal(sandbox.circleRadius, 160);
    assert.equal(sandbox.imageSize1, 'cover');
    assert.equal(calls.length, 0);
    sandbox.VisualizerRuntime.updateProperties({ backgroundsource: { value: 3 } });
    sandbox.run();
});

test('early WE values merge with defaults; native audio preserved and retired rotation ignored', () => {
    const { sandbox, load, calls, elements } = environment(true);
    sandbox.wallpaperPropertyListener.applyUserProperties({ circleradius: { value: 120 }, resposive: { value: 70 } });
    load('main.js');
    assert.equal(sandbox.circleRadius, 120);
    assert.equal(sandbox.normaliseReposiveness, 0.7);
    assert.equal(sandbox.barLength, 100);
    assert.deepEqual(calls, ['register']);
    sandbox.weAudio(Array(128).fill(0.5));
    const first = sandbox.audioSample[0];
    sandbox.VisualizerRuntime.deliverLocalAudio(Array(128).fill(0));
    assert.equal(sandbox.audioSample[0], first);
    sandbox.wallpaperPropertyListener.applyUserProperties({ backgroundsource: { value: 3 } });
    assert.deepEqual(calls, ['register']);
    assert.equal(sandbox.VisualizerRuntime.getSettings().backgroundsource.value, 2);
    sandbox.run();
});

test('unified updates retain all current keys, handle all combo branches and protect snapshots', () => {
    const { sandbox, load } = environment();
    load('main.js');
    const runtime = sandbox.VisualizerRuntime;
    for (const [key, property] of Object.entries(schema)) {
        if (property.type === 'text') continue;
        const values = property.type === 'combo' ? property.options.map(option => option.value)
            : property.type === 'bool' ? [true, false] : [property.value ?? ''];
        for (const value of values) {
            runtime.updateProperties({ [key]: { value } });
            sandbox.run();
        }
    }
    const state = runtime.getSettings();
    state.circleradius.value = 999;
    assert.notEqual(runtime.getSettings().circleradius.value, 999);
    const before = JSON.stringify(runtime.getSettings());
    assert.throws(() => runtime.updateProperties({ circleradius: { value: 77 }, barheight: { value: NaN } }));
    assert.equal(JSON.stringify(runtime.getSettings()), before);
    assert.equal(Object.keys(runtime.getSettings()).length, 86);
    runtime.updateProperties({ schemecolor: { value: '0 1 0' }, rainbow: { value: true } });
    assert.equal(runtime.getSettings().schemecolor.value, '1 1 1');
    assert.equal(sandbox.RainBow, false);
    assert.equal(runtime.getSettings().rainbow, undefined);
});

test('original smoothing/mirroring chain and bass reaction remain usable', () => {
    const { sandbox, load } = environment();
    load('main.js');
    const data = Array(128).fill(0);
    data[1] = 1;
    for (let i = 0; i < 30; i++) sandbox.wallpaperAudioListener(data);
    assert.ok(sandbox.audioSample[0] + sandbox.audioSample[1] + sandbox.audioSample[2] > 1.15);
    assert.equal(sandbox.audioSample[0], sandbox.audioSample[127]);
    sandbox.VisualizerRuntime.updateProperties({ reverseright: { value: true } });
    sandbox.wallpaperAudioListener(data);
    assert.equal(sandbox.audioSample[1], sandbox.audioSample[65]);
    for (let i = 0; i < 90; i++) sandbox.wallpaperAudioListener(Array(128).fill(0));
    assert.ok(sandbox.audioSample.every(value => value < 1e-12));
});

test('spectrum mapper conserves boundary power, gates silence and limits input', () => {
    const { sandbox } = environment();
    const adapter = sandbox.VisualizerAudioAdapter;
    for (const sampleRate of [44100, 48000, 96000]) {
        const mapper = adapter.createSpectrumMapper(sampleRate, adapter.FFT_SIZE);
        const data = new Float32Array(adapter.FFT_SIZE / 2).fill(-Infinity);
        assert.ok(mapper.map(data).every(value => value === 0));
        data.fill(-110);
        assert.ok(mapper.map(data).every(value => value === 0));
        data.fill(-Infinity);
        const bin = Math.round(1000 / (sampleRate / adapter.FFT_SIZE));
        data[bin] = 20 * Math.log10(0.1 * Math.sqrt(adapter.BLACKMAN_POWER) / 2);
        const output = mapper.map(data);
        const norm = Math.sqrt(output.slice(0, 64).reduce((sum, value) => sum + value * value, 0));
        assert.ok(Math.abs(norm - 0.15) < 1e-6);
        assert.equal(output.length, 128);
        assert.equal(mapper.edges.length, 65);
        data.fill(0);
        assert.ok(mapper.map(data).every(value => value >= 0 && value <= 1));
    }
});

test('accepted FFT mapping and wallpaperAudioListener are unchanged', () => {
    const hash = text => crypto.createHash('sha256').update(text).digest('hex').toUpperCase();
    assert.equal(hash(fs.readFileSync(path.join(root, 'audio-adapter.js'))), '88BBCE2D97C18B8E8B2B0670860C362DEF8FD6BCD70D26AB9C38C5A57E78BFE4');
    const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
    const start = main.indexOf('function wallpaperAudioListener');
    const end = main.indexOf('function bg()', start);
    assert.equal(hash(main.slice(start, end)), '53A04626F0AD059A88C264CE7E73E1E34CEC30BDF6F5BA3B2B174D297FC6C663');
});

test('Input Gain changes only amplitude and is ignored by WE', () => {
    const { sandbox } = environment();
    const runtime = sandbox.VisualizerRuntime;
    let received;
    runtime.attachAudio(array => { received = Array.from(array); });
    const samples = Array.from({ length: 128 }, (_, index) => index === 11 ? 1 : index === 23 ? 0.3 : 0);
    for (const gain of [0.5, 1, 2]) {
        runtime.updateStandalone({ inputGain: gain });
        runtime.deliverLocalAudio(samples);
        assert.deepEqual(received, samples.map(value => value * gain));
        assert.equal(received.indexOf(Math.max(...received)), 11);
    }
    assert.throws(() => runtime.updateStandalone({ inputGain: Infinity }));
    const we = environment(true).sandbox;
    we.VisualizerRuntime.attachAudio(() => {});
    we.VisualizerRuntime.updateStandalone({ inputGain: 2 });
    assert.equal(we.VisualizerRuntime.getStandalone().inputGain, 1);
});

test('Preset roundtrip, complete defaults, unknown fields, clamps and atomic rejection', () => {
    const { sandbox, load } = environment();
    load('presets.js');
    const runtime = sandbox.VisualizerRuntime;
    const presets = sandbox.VisualizerPresets;
    runtime.updateProperties({ barheight: { value: 240 }, noise: { value: false }, logoimage: { value: 'blob:temporary' } });
    runtime.updateStandalone({ inputGain: 1.25 });
    const exported = presets.create('Test');
    assert.equal(Object.keys(exported.properties).length, 54);
    assert.equal(exported.properties.showclock, undefined);
    assert.equal(exported.properties.textfont, undefined);
    assert.equal(exported.properties.logoimage.value, '');
    assert.ok(!JSON.stringify(exported).includes('blob:'));
    presets.reset();
    assert.equal(runtime.getStandalone().inputGain, 3);
    presets.import(JSON.stringify(exported));
    assert.equal(runtime.getSettings().barheight.value, 240);
    assert.equal(runtime.getStandalone().inputGain, 1.25);
    const partial = { format: 'audio-visualizer-preset', version: 1, properties: {
        barheight: { value: 99999 }, resposive: -90, userspectrumrotation: 3.6,
        circlecolor: '2 -1 0.5', alien: true, backgroundsource: 999
    }, standalone: { inputGain: 100 } };
    const imported = presets.import(JSON.stringify(partial));
    assert.equal(runtime.getSettings().barheight.value, 3000);
    assert.equal(runtime.getSettings().resposive.value, 0);
    assert.equal(runtime.getSettings().userspectrumrotation.value, 4);
    assert.equal(runtime.getSettings().circlecolor.value, '1 0 0.5');
    assert.equal(runtime.getSettings().noise.value, true);
    assert.equal(runtime.getStandalone().inputGain, 4);
    assert.equal(imported.warnings.length, 2);
    const before = JSON.stringify(runtime.getSettings());
    for (const text of ['broken', '{}', '{"format":"audio-visualizer-preset","version":1,"properties":{"barheight":1e400}}',
        JSON.stringify({ ...partial, properties: { barheight: null } }), JSON.stringify({ ...partial, standalone: { inputGain: 'NaN' } })]) {
        assert.throws(() => presets.import(text));
        assert.equal(JSON.stringify(runtime.getSettings()), before);
    }
});

test('Cover caches one decode, handles races/errors/cancel, and revokes owned URLs', async () => {
    const { sandbox, load } = environment();
    const files = new Map();
    const revoked = [];
    const decodes = new Map();
    let nextURL = 0;
    sandbox.URL = {
        createObjectURL(file) { const url = 'blob:test-' + ++nextURL; files.set(url, file); return url; },
        revokeObjectURL(url) { revoked.push(url); }
    };
    sandbox.addEventListener = () => {};
    sandbox.Image = class {
        decode() {
            decodes.set(this.src, (decodes.get(this.src) || 0) + 1);
            const file = files.get(this.src);
            return new Promise((resolve, reject) => setTimeout(() => file?.bad ? reject(new Error('Bad image')) : resolve(), file?.slow ? 30 : 0));
        }
    };
    // Reload so image-cache uses this environment's Image implementation.
    load('image-cache.js');
    load('main.js');
    load('local-files.js');
    const manager = sandbox.VisualizerFiles;
    await manager.select('logoimage', [{ name: 'cover.png' }]);
    await new Promise(resolve => setTimeout(resolve, 1));
    const first = sandbox.VisualizerRuntime.getSettings().logoimage.value;
    const image = sandbox.VisualizerImages.getLogo();
    sandbox.run(); sandbox.run();
    assert.equal(decodes.get(first), 1);
    assert.ok(image);
    await manager.select('logoimage', []);
    assert.equal(sandbox.VisualizerRuntime.getSettings().logoimage.value, first);
    await assert.rejects(manager.select('logoimage', [{ name: 'bad.jpg', bad: true }]));
    assert.equal(sandbox.VisualizerRuntime.getSettings().logoimage.value, first);
    const slow = manager.select('logoimage', [{ name: 'slow.png', slow: true }]);
    const fast = manager.select('logoimage', [{ name: 'fast.webp' }]);
    await Promise.all([slow, fast]);
    assert.equal(manager.getName('logoimage'), 'fast.webp');
    assert.ok(revoked.includes(first));
    const active = sandbox.VisualizerRuntime.getSettings().logoimage.value;
    assert.equal(decodes.get(active), 1);
    manager.clear('logoimage');
    assert.ok(revoked.includes(active));
    assert.equal(sandbox.VisualizerImages.getLogo(), null);
    assert.equal(new Set(revoked).size, revoked.length);
});


test('geometry samples one processed spectrum, mirrors, reverses, and separates amplitude from placement', () => {
    const { sandbox, load } = environment();
    load('main.js');
    const geometry = sandbox.VisualizerGeometry;
    const samples = Array.from({ length: 128 }, (_, i) => i / 63);
    const config = { ...sandbox.VisualizerLayoutSettings.defaults(), layout: 'linear', barCount: 8 };
    const before = JSON.stringify(samples);
    let output = geometry.build(samples, config);
    assert.equal(output.bars.length, 8);
    assert.equal(output.bars[0].frequency, 0);
    assert.equal(output.bars[7].frequency, 63);
    assert.equal(output.bars[7].length, config.height);
    assert.equal(output.bars[7].ny, -1);
    assert.equal(JSON.stringify(samples), before);
    const centered = geometry.build(samples, { ...config, mirror: 'center' }).bars;
    assert.equal(centered[3].frequency, 63);
    for (let i = 0; i < 8; i++) assert.equal(centered[i].frequency, centered[7-i].frequency);
    const dual = geometry.build(samples, { ...config, mirror: 'dual' }).bars;
    assert.equal(dual.length, 16);
    for (let i = 0; i < 16; i += 2) assert.equal(dual[i].length, -dual[i+1].length);
    const reversed = geometry.build(samples, { ...config, reverse: true }).bars;
    for (let i = 0; i < 8; i++) assert.equal(reversed[i].frequency, output.bars[7-i].frequency);
    const vertical = geometry.build(samples, { ...config, orientation: 'vertical' }).bars;
    assert.equal(vertical[7].nx, 1);
    assert.equal(vertical[7].length, config.width);
    assert.equal(vertical[7].x, 0);
    const negative = geometry.build(samples, { ...config, amplitudeDirection: 'negative' }).bars;
    assert.equal(negative[7].length, -config.height);
    const anchored = geometry.build(samples, { ...config, anchor: 'start' }).bars;
    assert.ok(anchored[0].x > 0 && anchored[7].x < config.width);
    const square = { ...config, layout: 'square', barCount: 16 };
    const outward = geometry.build(samples, square, { center: 10, bars: 12, distance: 5 });
    assert.equal(outward.half, square.squareSize / 2 + 10);
    for (const [i, nx, ny] of [[0,0,-1],[4,1,0],[8,0,1],[12,-1,0]]) {
        assert.equal(outward.bars[i].nx, nx); assert.equal(outward.bars[i].ny, ny);
    }
    const inward = geometry.build(samples, { ...square, direction: 'inward' });
    assert.equal(inward.bars[15].length, -outward.bars[15].length);
    for (const layout of ['circle','square','linear']) {
        sandbox.VisualizerRuntime.updateStandalone({ visualizer: { layout, rotation: 45 } });
        sandbox.run(); // Proxy rejects NaN and Infinity in every drawing argument.
    }
});

test('geometry presets roundtrip, clamp, default old presets, and reject atomically', () => {
    const { sandbox, load } = environment(); load('main.js'); load('presets.js');
    const runtime = sandbox.VisualizerRuntime, presets = sandbox.VisualizerPresets;
    runtime.updateStandalone({ visualizer: { layout: 'linear', mirror: 'center', rotation: 55, reverse: true } });
    const exported = presets.create('Geometry');
    presets.reset(); presets.import(JSON.stringify(exported));
    assert.equal(runtime.getStandalone().visualizer.layout, 'linear');
    assert.equal(runtime.getStandalone().visualizer.reverse, true);
    const partial = { format: 'audio-visualizer-preset', version: 1, properties: {}, standalone: { visualizer: { width: 99999, barCount: 3.5, unknown: 1 } } };
    presets.import(JSON.stringify(partial));
    assert.equal(runtime.getStandalone().visualizer.width, 1920);
    assert.equal(runtime.getStandalone().visualizer.barCount, 4);
    assert.equal(runtime.getStandalone().visualizer.layout, 'circle');
    const before = JSON.stringify(runtime.getStandalone());
    for (const visualizer of [{ rotation: Infinity }, { width: 'NaN' }, { layout: 'invalid' }, { reverse: 1 }, []]) {
        assert.throws(() => presets.import(JSON.stringify({ ...partial, standalone: { visualizer } })));
        assert.equal(JSON.stringify(runtime.getStandalone()), before);
    }
    assert.throws(() => runtime.updateStandalone({ inputGain: 2, visualizer: { height: NaN } }));
    assert.equal(JSON.stringify(runtime.getStandalone()), before);
    presets.import(JSON.stringify({ ...partial, standalone: { inputGain: 1.5 } }));
    assert.equal(JSON.stringify(runtime.getStandalone().visualizer), JSON.stringify(sandbox.VisualizerLayoutSettings.defaults()));
    presets.reset();
    assert.equal(JSON.stringify(runtime.getStandalone()), JSON.stringify(runtime.getStandaloneDefaults()));
});

test('lyrics presets save settings only, default legacy fields, clamp and reject atomically', () => {
    const { sandbox, load } = environment(); load('main.js'); load('presets.js');
    const runtime = sandbox.VisualizerRuntime, presets = sandbox.VisualizerPresets;
    runtime.updateStandalone({ lyrics: { enabled: false, currentColor: '#92cfff', globalOffsetMs: 251, glowAttack: 123, fontFamily: 'Georgia' } });
    const preset = presets.create('Lyrics');
    assert.equal(Object.keys(preset.standalone.lyrics).length, 38);
    assert.ok(!JSON.stringify(preset).includes('activeIndex'));
    assert.ok(!JSON.stringify(preset).includes('fileOffsetMs'));
    const expected = JSON.stringify(preset.standalone.lyrics);
    presets.reset(); presets.import(JSON.stringify(preset));
    assert.equal(JSON.stringify(runtime.getStandalone().lyrics), expected);
    delete preset.standalone.lyrics;
    presets.import(JSON.stringify(preset));
    assert.equal(JSON.stringify(runtime.getStandalone().lyrics), JSON.stringify(sandbox.VisualizerLyricsSettings.defaults()));
    preset.standalone.lyrics = { fontSize: 10000, globalOffsetMs: -99999, unknown: true, glowMaxOpacity: 99 };
    presets.import(JSON.stringify(preset));
    assert.equal(runtime.getStandalone().lyrics.fontSize, 96);
    assert.equal(runtime.getStandalone().lyrics.globalOffsetMs, -5000);
    const before = JSON.stringify(runtime.getStandalone());
    for (const lyrics of [{fontSize:'NaN'},{glowMaxOpacity:null},{currentColor:'url(x)'},{fontWeight:900},[]]) {
        assert.throws(() => presets.import(JSON.stringify({...preset, standalone:{lyrics}})));
        assert.equal(JSON.stringify(runtime.getStandalone()), before);
    }
    assert.throws(() => runtime.updateStandalone({inputGain: 2, lyrics:{globalOffsetMs:Infinity}}));
    assert.equal(JSON.stringify(runtime.getStandalone()), before);
});

test('asset cleanup removes bundled media/fonts and all live asset references resolve', () => {
    for (const file of ['font', '1.webm', '2.webm', '3.webm', 'preview.jpg']) assert.equal(fs.existsSync(path.join(root, file)), false, file);
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    for (const match of html.matchAll(/(?:src|href)\s*=\s*"([^"]+)"/g)) {
        assert.ok(fs.existsSync(path.join(root, match[1])), match[1]);
    }
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'project.json'))).preview, undefined);
    const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
    assert.doesNotMatch(main, /prompt\s*\(|function clock\s*\(|new Date\(|\.webm|showClock|clockFont|textFont/);
    assert.doesNotMatch(html, /font\/|bgvid/);
    assert.match(main, /Copyright \(c\) \[2017\] \[Karteek Suryadevara\|\|V3ng3nc3\]/);
});

test('Song Info defaults, validation, atomic import, legacy keys and bass aliases', () => {
    const { sandbox, load } = environment(); load('main.js'); load('presets.js');
    const runtime = sandbox.VisualizerRuntime, api = sandbox.VisualizerSongInfoSettings, presets = sandbox.VisualizerPresets;
    assert.equal(runtime.getStandalone().text.title, 'Song Title');
    assert.equal(runtime.getStandalone().text.artist, 'Artist');
    assert.equal(runtime.getStandalone().text.color, '#ffffff');
    runtime.updateStandalone({ text: { title: '<img src=x onerror=alert(1)>', artist: '', scale: 99, lineGap: -1, fontFamily: 'waltographregular', bassReaction: true, bassStrength: 160 } });
    assert.equal(runtime.getStandalone().text.scale, 4);
    assert.equal(runtime.getStandalone().text.lineGap, 0);
    assert.equal(runtime.getStandalone().text.fontFamily, 'system-ui');
    assert.equal(runtime.getSettings().bassshaketext.value, true);
    assert.equal(runtime.getSettings().txtbassmultiplier.value, 160);
    assert.equal(api.bassScale([1,1,1,1,1], runtime.getStandalone().text), 2.25);
    runtime.updateProperties({ bassshaketext: { value: false }, txtbassmultiplier: { value: 80 } });
    assert.equal(runtime.getStandalone().text.bassReaction, false);
    assert.equal(api.bassScale([1,1,1,1,1], runtime.getStandalone().text), 1);
    const exported = presets.create('Song Info');
    assert.equal(exported.properties.showclock, undefined);
    assert.equal(exported.properties.textfont, undefined);
    presets.reset(); presets.import(JSON.stringify(exported));
    assert.equal(runtime.getStandalone().text.title, exported.standalone.text.title);
    assert.equal(runtime.getStandalone().text.artist, '');
    const old = { format: 'audio-visualizer-preset', version: 1, properties: { showclock: {value:true}, clockfont: {value:'retired invalid value'}, showtext: true, textfont: 999, backgroundsource: 4 }, standalone: { lyrics: { fontFamily: 'special_eliteregular' } } };
    presets.import(JSON.stringify(old));
    assert.equal(runtime.getStandalone().text.title, 'Song Title');
    assert.equal(runtime.getStandalone().lyrics.fontFamily, 'system-ui');
    assert.equal(runtime.getSettings().backgroundsource.value, 1);
    assert.equal(runtime.getSettings().showclock.value, false);
    const before = JSON.stringify(runtime.getStandalone());
    for (const text of [{scale:Infinity}, {title:7}, {color:'url(x)'}, {alignment:'invalid'}, {fontFamily:1}, []]) {
        assert.throws(() => runtime.updateStandalone({inputGain: 2, text}));
        assert.equal(JSON.stringify(runtime.getStandalone()), before);
        assert.throws(() => presets.import(JSON.stringify({...old, standalone:{text}})));
        assert.equal(JSON.stringify(runtime.getStandalone()), before);
    }
    presets.reset();
    assert.equal(JSON.stringify(runtime.getStandalone().text), JSON.stringify(runtime.getStandaloneDefaults().text));
});

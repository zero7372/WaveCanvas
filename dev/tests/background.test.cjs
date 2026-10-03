const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..', '..', 'app');
function modules() {
    const app = { window: null }; app.window = app; vm.createContext(app);
    for (const file of ['background-schema.js', 'background-motion.js', 'lyrics-runtime.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), app);
    return app;
}
test('Infinity follows a bounded figure eight and matches position and derivative at loop seam', () => {
    const { VisualizerBackgroundMotion: motion } = modules(), out = { x: 0, y: 0 };
    for (let i = 0; i <= 10000; i++) {
        assert.equal(motion.drift(i * motion.TAU / 10000, 18, out), out);
        assert.ok(Math.abs(out.x) <= 18 && Math.abs(out.y) <= 8.1 + 1e-10);
    }
    motion.drift(0, 18, out); assert.equal(out.x, 0); assert.equal(out.y, 0);
    motion.drift(motion.TAU, 18, out); assert.ok(Math.abs(out.x) < 1e-12 && Math.abs(out.y) < 1e-12);
    const h = 0.0001, a = {}, b = {};
    motion.drift(h, 18, a); motion.drift(motion.TAU + h, 18, b);
    assert.ok(Math.abs(a.x - b.x) < 1e-12 && Math.abs(a.y - b.y) < 1e-12);
    motion.drift(Math.PI / 4, 18, a); motion.drift(Math.PI * 3 / 4, 18, b);
    assert.ok(a.x > 0 && b.x > 0 && a.y > 0 && b.y < 0);
});
test('Coverage accounts for offsets, blur and movement; centered bass ignores offsets', () => {
    const app = modules(), motion = app.VisualizerBackgroundMotion, defaults = app.VisualizerBackgroundSettings.defaults();
    assert.equal(motion.coverage(defaults), 1.08);
    for (const settings of [defaults, {...defaults,offsetX:1920,offsetY:-1080,blur:80}, {...defaults,baseScale:1,driftAmount:60}]) {
        const scale = motion.coverage(settings);
        assert.ok((scale - 1) * 960 >= Math.abs(settings.offsetX) + settings.driftAmount + settings.blur * 3 - 1e-8);
        assert.ok((scale - 1) * 540 >= Math.abs(settings.offsetY) + settings.driftAmount * .45 + settings.blur * 3 - 1e-8);
    }
    assert.equal(motion.coverage({...defaults,mode:'bassPulse',offsetX:1920,offsetY:1080}), 1.08);
});
test('Bass uses processed low bins only, bounds impulses and releases monotonically', () => {
    const app = modules(), motion = app.VisualizerBackgroundMotion, smooth = app.VisualizerLyricsRuntime.envelope;
    const samples = Array(128).fill(0); samples[20] = 100;
    assert.equal(motion.bass(samples), 0); samples[1] = .4; assert.equal(motion.bass(samples), .4);
    samples[2] = 100; assert.equal(motion.bass(samples), 1); samples[1] = NaN; samples[2] = Infinity; assert.equal(motion.bass(samples), 0);
    let value = 0;
    for (let i = 0; i < 60; i++) { const next = smooth(value, 1, 1000/60, 140, 850); assert.ok(next >= value && next <= 1); value = next; }
    const peak = value;
    value = smooth(value, 0, 140, 140, 850); assert.ok(value > peak * .8);
    for (let i = 0; i < 600; i++) { const next = smooth(value, 0, 1000/60, 140, 850); assert.ok(next <= value && next >= 0); value = next; }
    assert.ok(value < .0001);
});
test('Background settings default old presets, migrate old mode and clamp finite values', () => {
    const schema = modules().VisualizerBackgroundSettings;
    assert.equal(Object.keys(schema.properties).length, 13);
    const normalized = schema.normalize({mode:'slideshow',bassAttack:-2,bassRelease:99999,baseScale:99,driftAmount:999,enabled:false,unknown:1});
    assert.equal(normalized.mode,'infinity'); assert.equal(normalized.bassAttack,20); assert.equal(normalized.bassRelease,5000);
    assert.equal(normalized.baseScale,2); assert.equal(normalized.driftAmount,60); assert.equal(normalized.enabled,false);
    for (const patch of [{mode:'random'},{enabled:1},{driftSpeed:NaN},{bassScaleAmount:Infinity}]) assert.throws(() => schema.normalize(patch));
});
test('Infinity stage advances while paused and restarts after idle Bass, disable and Home', () => {
    const app = modules(), events = new Map(), frames = new Map();
    const image = { style: {}, hidden: false }, stage = { style: {} }, editor = { hidden: false };
    const audio = { paused: true, addEventListener: (key, callback) => events.set('audio.' + key, callback) };
    let id = 0, subscriber, settings = app.VisualizerBackgroundSettings.defaults();
    let properties = { backgroundsource: { value: 2 }, backgroundimage: { value: 'blob:test-image' } };
    app.document = { hidden: false, querySelector: key => ({'#bgimg':image,'#stage':stage,'#editor-view':editor,'#local-audio':audio}[key]),
        addEventListener: (key, callback) => events.set('document.' + key, callback) };
    app.addEventListener = (key, callback) => events.set(key, callback);
    app.requestAnimationFrame = callback => { frames.set(++id, callback); return id; };
    app.cancelAnimationFrame = key => frames.delete(key);
    app.audioSample = Array(128).fill(0);
    app.VisualizerRuntime = { mode: 'standalone', subscribe(callback) { subscriber = callback; callback(properties, {background:settings}); } };
    vm.runInContext(fs.readFileSync(path.join(root, 'background-stage.js'), 'utf8'), app);
    const tick = time => { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(time); };
    const update = patch => { settings = {...settings,...patch}; subscriber(properties,{background:settings}); };
    tick(1000); const initial = image.style.transform; tick(1100);
    assert.notEqual(image.style.transform, initial, 'Infinity moves even when audio is paused');
    const displacement = Number(image.style.transform.match(/translate3d\(([^p]+)px/)[1]);
    assert.ok(Math.abs(displacement - 18 * Math.sin(Math.PI * 2 * 100 / 60000)) < 1e-10, '1x is a 60-second cycle');
    for (let time = 1200; time <= 61100; time += 100) tick(time);
    const fullCycle = Number(image.style.transform.match(/translate3d\(([^p]+)px/)[1]);
    assert.ok(Math.abs(fullCycle - displacement) < 1e-9, 'Renderer returns to the same position after 60 seconds');
    assert.equal(frames.size, 1, 'Only one background RAF');
    update({mode:'bassPulse'}); tick(1200); assert.equal(frames.size, 0, 'Silent paused Bass goes idle');
    update({mode:'infinity'}); assert.equal(frames.size, 1); tick(1300); const resumed = image.style.transform;
    tick(1400); assert.notEqual(image.style.transform,resumed, 'Switching back restarts drift');
    update({enabled:false}); assert.equal(frames.size,0); assert.equal(image.hidden,true);
    update({enabled:true}); assert.equal(frames.size,1); assert.equal(image.hidden,false);
    editor.hidden=true;events.get('wavecanvas-view-change')();assert.equal(frames.size,0);
    editor.hidden=false;events.get('wavecanvas-view-change')();assert.equal(frames.size,1);
    tick(50000);const afterHome=image.style.transform;tick(50100);assert.notEqual(image.style.transform,afterHome);
    app.document.hidden=true;events.get('document.visibilitychange')();assert.equal(frames.size,0);
    app.document.hidden=false;events.get('document.visibilitychange')();assert.equal(frames.size,1);
});
test('Protected audio, Lyrics and Timing modules remain byte-identical', () => {
    const hashes = JSON.parse(fs.readFileSync(path.join(root, '../dev/tests/artifacts/background-protected-hashes.json')));
    for (const [file, expected] of Object.entries(hashes)) {
        // Square geometry is now intentionally changed and covered by square.test.cjs.
        // Template/media UI intentionally changes shell, not Background/audio/Lyrics/Timing.
        // SRT import adds source metadata to runtime/model; srt.test.cjs protects renderer/audio and tests edits.
        if (['visualizer-geometry.js','wavecanvas-shell.js','lyrics-runtime.js','timing-model.js'].includes(file)) continue;
        let source = fs.readFileSync(path.join(root, file === 'wallpaperAudioListener' ? 'main.js' : file), 'utf8');
        if (file === 'wallpaperAudioListener') source = source.slice(source.indexOf('function wallpaperAudioListener'), source.indexOf('function bg()'));
        assert.equal(crypto.createHash('sha256').update(source).digest('hex'), expected, file);
    }
});

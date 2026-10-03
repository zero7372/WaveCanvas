const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '../..'), runner = require('../../electron/ffmpeg-runner.cjs');
test('Frame count uses ceil at 60 FPS including short and non-integral durations', () => {
    for (const [duration, count] of [[.001, 1], [5, 300], [10, 600], [60, 3600], [300, 18000], [60.1861041667, 3612]]) assert.equal(runner.frames(duration), count);
    for (const invalid of [0, -1, Infinity, NaN, 21601]) assert.throws(() => runner.frames(invalid));
});
test('FFmpeg args constrain CPU H.264, canonical BGRA, AAC, ordering and exact frame count', () => {
    const args = runner.args('中文 source.mp3', 'output.mp4', 300);
    for (const [key, value] of [['-pixel_format', 'bgra'], ['-video_size', '1920x1080'], ['-framerate', '60'], ['-c:v', 'libx264'], ['-c:a', 'aac'], ['-pix_fmt', 'yuv420p'], ['-frames:v', '300'], ['-b:a', '320k']]) assert.equal(args[args.indexOf(key) + 1], value);
    assert.equal(args.at(-1), 'output.mp4'); assert.ok(args.includes('中文 source.mp3')); assert.equal(args.filter(value => value === '-i').length, 2);
});
test('Atomic temporary outputs stay beside target and never equal the final path', () => {
    const output = path.resolve('test.mp4'), a = runner.temporary(output), b = runner.temporary(output);
    assert.equal(path.dirname(a), path.dirname(output)); assert.notEqual(a, b); assert.notEqual(a, output); assert.match(a, /\.partial\.mp4$/);
});
function analysis(pcm, sampleRate, count) {
    let cache; const context = { Float32Array, Float64Array, Uint16Array, Math, self: null }; context.self = context;
    context.postMessage = data => { if (data.cache) cache = data.cache; if (data.error) throw Error(data.error); };
    vm.createContext(context);
    context.importScripts = file => vm.runInContext(fs.readFileSync(path.join(root, 'app', file), 'utf8'), context);
    vm.runInContext(fs.readFileSync(path.join(root, 'app/export-audio-worker.js'), 'utf8'), context);
    context.onmessage({ data: { pcm, sampleRate, count } }); return cache;
}
test('Offline FFT uses causal Blackman, existing 64-band mapper and duplicated input half', () => {
    const rate = 48000, pcm = Float32Array.from({ length: rate }, (_, i) => .2 * Math.sin(2 * Math.PI * 96 * i / rate));
    const cache = analysis(pcm, rate, 31); assert.equal(cache.length, 31 * 128);
    assert.ok(cache.slice(0, 128).every(value => value === 0));
    const bins = cache.slice(20 * 128, 20 * 128 + 64), maximum = Math.max(...bins);
    assert.ok(maximum > .2 && maximum < .4, 'Peak amplitude is calibrated through the original power mapper');
    const peak = bins.indexOf(maximum); assert.ok(peak === 2 || peak === 3, '96 Hz remains in its original low frequency band');
    assert.deepEqual(cache.slice(20 * 128, 20 * 128 + 64), cache.slice(20 * 128 + 64, 21 * 128));
    assert.deepEqual(cache, analysis(pcm, rate, 31));
});
test('Offline silence is finite zero without NaN', () => assert.ok(analysis(new Float32Array(48000), 48000, 31).every(value => value === 0)));
test('Export stage reuses preview modules without Project controller or Editor UI', () => {
    const html = fs.readFileSync(path.join(root, 'app/export.html'), 'utf8');
    for (const file of ['main.js', 'lyrics-stage.js', 'background-stage.js', 'song-info-stage.js', 'linear-cover.js', 'audio-adapter.js']) assert.ok(html.includes('src="' + file + '"'));
    for (const file of ['project-controller.js', 'timing-editor.js', 'local-audio.js']) assert.ok(!html.includes('src="' + file + '"'));
    const editor = fs.readFileSync(path.join(root, 'app/index.html'), 'utf8');
    const stage = text => text.slice(text.indexOf('<main id="stage"'), text.indexOf('</main>') + 7); assert.equal(stage(html), stage(editor));
});

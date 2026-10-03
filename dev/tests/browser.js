/* Browser-only regression fixtures. No test code is loaded by index.html. */
const results = document.querySelector('#results');
const calibration = [];
let failures = 0;
function check(condition, name) {
    results.textContent += '\n' + (condition ? 'PASS ' : 'FAIL ') + name;
    if (!condition) failures++;
}
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function fixture(id, we) {
    const html = await (await fetch('../../app/index.html')).text();
    const setup = `<base href="../../app/"><script>
        window.fixtureErrors = [];
        window.addEventListener('error', event => fixtureErrors.push(event.message));
        window.addEventListener('unhandledrejection', event => fixtureErrors.push(String(event.reason)));
        ${we ? `window.weRegistrations = 0;
        window.wallpaperRegisterAudioListener = function(listener) { weRegistrations++; window.weAudio = listener; };
        window.wallpaperRequestRandomFileForProperty = function(key, callback) { callback(key, ''); };` : ''}
    <\/script>`;
    const frame = document.querySelector('#' + id);
    const loaded = new Promise(resolve => frame.addEventListener('load', resolve, { once: true }));
    frame.srcdoc = html.replace('<head>', '<head>' + setup);
    await loaded;
    if (!we) {
        const app = frame.contentWindow;
        check(app.WaveCanvasShell.getView() === 'HOME' && !app.document.querySelector('#home-view').hidden, 'WaveCanvas starts on Home');
        app.document.querySelector('#new-project').click();
    }
    return frame.contentWindow;
}

function wavFile(name, frequency, amplitude, duration = 4) {
    const sampleRate = 48000;
    const samples = sampleRate * duration;
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);
    const text = (offset, value) => [...value].forEach((character, i) => view.setUint8(offset + i, character.charCodeAt(0)));
    text(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, samples * 2, true);
    for (let i = 0; i < samples; i++) view.setInt16(44 + i * 2, amplitude * 32767 * Math.sin(2 * Math.PI * frequency * i / sampleRate), true);
    return new File([buffer], name, { type: 'audio/wav' });
}

function selectFile(app, file) {
    const transfer = new app.DataTransfer();
    transfer.items.add(file);
    const input = app.document.querySelector('#audio-file');
    input.files = transfer.files;
    input.dispatchEvent(new app.Event('change'));
}

async function loadedAudio(audio) {
    if (audio.readyState >= 1) return;
    await Promise.race([
        new Promise((resolve, reject) => {
            audio.addEventListener('loadedmetadata', resolve, { once: true });
            audio.addEventListener('error', () => reject(new Error('Audio decode failed')), { once: true });
        }),
        delay(5000).then(() => { throw new Error('Audio metadata timeout'); })
    ]);
}

document.querySelector('#run').addEventListener('click', async () => {
    failures = 0;
    calibration.length = 0;
    document.querySelector('#run').disabled = true;
    results.textContent = 'Running';
    try {
        const [app, we] = await Promise.all([fixture('standalone', false), fixture('we', true)]);
        check(app.VisualizerRuntime.mode === 'standalone' && Object.keys(app.VisualizerRuntime.getSettings()).length === 86, 'Standalone: 86 runtime settings');
        check(app.document.querySelector('#local-audio-panel').hidden === false, 'Standalone audio controls visible');
        check(we.VisualizerRuntime.mode === 'wallpaper-engine' && we.weRegistrations === 1 && we.document.querySelector('#local-audio-panel').hidden, 'WE: native API registered once; local controls hidden');
        app.VisualizerRuntime.updateProperties({ backgroundsource: { value: 3 } });
        app.VisualizerRuntime.updateProperties({ backgroundsource: { value: 1 } });
        we.wallpaperPropertyListener.applyUserProperties({ circleradius: { value: 90 }, resposive: { value: 50 } });
        we.weAudio(Array(128).fill(0.3));
        check(we.circleRadius === 90 && we.normaliseReposiveness === 0.5 && we.audioSample[0] > 0, 'WE settings and audio reach original visualizer');

        const audio = app.document.querySelector('#local-audio');
        selectFile(app, wavFile('bass.wav', 60, 0.8));
        await loadedAudio(audio);
        await audio.play();
        await delay(600);
        check(audio.currentTime > 0 && app.audioSample.every(Number.isFinite) && app.sum > 0, 'Local WAV plays and produces finite FFT');
        check(app.audioSample[0] + app.audioSample[1] + app.audioSample[2] > 1.15, 'Strong bass triggers original shake threshold');
        audio.pause();
        await delay(800);
        check(app.audioSample.every(value => value < 0.002), 'Pause decays original smoothing to silence');
        audio.currentTime = 2;
        await audio.play();
        await delay(250);
        check(audio.currentTime > 2 && app.sum > 0, 'Seek then play resumes analysis');
        app.dispatchEvent(new app.PageTransitionEvent('pagehide', { persisted: true }));
        check(audio.paused, 'BFCache pagehide pauses local audio');
        await audio.play();
        await delay(250);
        check(app.sum > 0, 'BFCache retained graph can resume analysis');
        const previousURL = audio.src;
        selectFile(app, wavFile('silence.wav', 0, 0));
        await loadedAudio(audio);
        await audio.play();
        await delay(800);
        check(audio.src !== previousURL && app.sum === 0 && app.audioSample.every(value => value < 0.002), 'Replace file: new URL and no stale spectrum');
        audio.pause();
        selectFile(app, wavFile('quiet-bass.wav', 60, 0.1));
        await loadedAudio(audio);
        await audio.play();
        await delay(600);
        check(app.sum > 0 && app.audioSample[0] + app.audioSample[1] + app.audioSample[2] < 1.15,
            'Quiet bass remains visible without false shake trigger');
        audio.pause();
        selectFile(app, new File(['invalid'], 'bad.mp3', { type: 'audio/mpeg' }));
        await delay(400);
        check(app.document.querySelector('#audio-status').textContent.includes('無法解碼'), 'Unsupported/corrupt audio reports decode error');

        await runFeatureTests(app, we, check);
        await runSongInfoTests(app, we, check);
        await runShellTests(app, check);
        await runGeometryTests(app, we, check);
        await runInspectorTests(app, check);
        await runLyricsTests(app, we, check);
        await runTimingTests(app, check);
        await runBackgroundTests(app, we, check);
        await runPerformanceTests(app, we, check);
        for (const requestedRate of [44100, 48000]) {
            const context = new AudioContext({ sampleRate: requestedRate });
            await context.resume();
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            const analyser = context.createAnalyser();
            analyser.fftSize = VisualizerAudioAdapter.FFT_SIZE;
            analyser.smoothingTimeConstant = 0;
            const mute = context.createGain(); mute.gain.value = 0;
            oscillator.connect(gain); gain.connect(analyser); analyser.connect(mute); mute.connect(context.destination);
            oscillator.start();
            const mapper = VisualizerAudioAdapter.createSpectrumMapper(context.sampleRate, analyser.fftSize);
            const bins = new Float32Array(analyser.frequencyBinCount);
            for (const frequency of [60, 1000, 10000]) {
                for (const amplitude of [0.1, 0.5, 0.8]) {
                    oscillator.frequency.value = frequency;
                    gain.gain.value = amplitude;
                    await delay(240);
                    analyser.getFloatFrequencyData(bins);
                    const mapped = mapper.map(bins).slice(0, 64);
                    const norm = Math.sqrt(mapped.reduce((sum, value) => sum + value * value, 0));
                    calibration.push({ sampleRate: context.sampleRate, frequency, amplitude, norm: Number(norm.toFixed(4)), max: Number(Math.max(...mapped).toFixed(4)) });
                    check(amplitude < 0.8 ? Math.abs(norm - amplitude * 1.5) < 0.035 : norm >= 0.95 && norm <= 1.21,
                        `FFT ${context.sampleRate} Hz / ${frequency} Hz / peak ${amplitude}: L2=${norm.toFixed(4)}`);
                }
            }
            gain.gain.value = 0;
            await delay(240);
            analyser.getFloatFrequencyData(bins);
            check(mapper.map(bins).every(value => value === 0), `FFT ${context.sampleRate} Hz: digital silence maps to zero`);
            gain.gain.value = 0.000001;
            await delay(240);
            analyser.getFloatFrequencyData(bins);
            check(mapper.map(bins).every(value => value === 0), `FFT ${context.sampleRate} Hz: sub-floor tone maps to zero`);
            oscillator.stop();
            await context.close();
        }
        check(app.fixtureErrors.length === 0, 'Standalone: no page errors or unhandled promises ' + JSON.stringify(app.fixtureErrors));
        check(we.fixtureErrors.length === 0, 'WE simulation: no page errors or unhandled promises ' + JSON.stringify(we.fixtureErrors));
        results.textContent += '\nCALIBRATION\n' + JSON.stringify(calibration, null, 2);
    } catch (error) {
        check(false, error.stack || error.message);
    }
    results.textContent += '\nDONE failures=' + failures;
    document.querySelector('#run').disabled = false;
});

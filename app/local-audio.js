(function () {
    'use strict';

    const runtime = window.VisualizerRuntime;
    const panel = document.querySelector('#local-audio-panel');
    if (runtime.mode !== 'standalone') return;
    panel.hidden = false;
    const audio = document.querySelector('#local-audio');
    const input = document.querySelector('#audio-file');
    const status = document.querySelector('#audio-status');
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    let context = null;
    let source = null;
    let analyser = null;
    let mapper = null;
    let decibels = null;
    let objectURL = null;
    let lastSampleTime = 0;
    let frame = null;
    let selection = 0;
    let fileName = '';
    let currentFile = null;
    const silence = new Array(128).fill(0);

    function ensureGraph() {
        if (context) return;
        if (!AudioContextClass) throw new Error('此瀏覽器不支援 Web Audio API。');
        context = new AudioContextClass();
        source = context.createMediaElementSource(audio);
        analyser = context.createAnalyser();
        analyser.fftSize = window.VisualizerAudioAdapter.FFT_SIZE;
        analyser.smoothingTimeConstant = 0;
        source.connect(context.destination); // Preserve stereo playback and native volume controls.
        source.connect(analyser);
        mapper = window.VisualizerAudioAdapter.createSpectrumMapper(context.sampleRate, analyser.fftSize);
        decibels = new Float32Array(analyser.frequencyBinCount);
    }

    function tick(timestamp) {
        frame = window.requestAnimationFrame(tick);
        if (timestamp - lastSampleTime < 1000 / 30) return;
        lastSampleTime = timestamp - ((timestamp - lastSampleTime) % (1000 / 30));
        if (!context || context.state !== 'running' || audio.paused || audio.ended || audio.seeking || audio.readyState < 2) {
            runtime.deliverLocalAudio(silence);
        } else {
            analyser.getFloatFrequencyData(decibels);
            runtime.deliverLocalAudio(mapper.map(decibels));
        }
    }

    function showError(message) {
        audio.pause();
        status.textContent = message;
        runtime.deliverLocalAudio(silence);
    }

    function loadFile(file) {
        if (!file) return;
        selection++;
        fileName = file.name;
        currentFile = file;
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        if (objectURL) URL.revokeObjectURL(objectURL);
        objectURL = null;
        runtime.deliverLocalAudio(silence);
        try {
            ensureGraph();
            objectURL = URL.createObjectURL(file);
            audio.src = objectURL;
            status.textContent = '載入中：' + file.name;
            audio.load();
        } catch (error) {
            showError(error.message);
        }
        window.dispatchEvent(new Event('local-audio-change'));
    }

    input.addEventListener('change', () => { const file = input.files[0]; input.value = ''; loadFile(file); });
    function clearFile() {
        selection++; fileName = ''; currentFile = null; audio.pause(); audio.removeAttribute('src'); audio.load();
        if (objectURL) URL.revokeObjectURL(objectURL);
        objectURL = null; input.value = ''; runtime.deliverLocalAudio(silence);
        status.textContent = '選擇本地音訊以開始預覽。';
        window.dispatchEvent(new Event('local-audio-change'));
    }
    window.VisualizerLocalAudio = Object.freeze({ load: loadFile, clear: clearFile, getName: () => fileName, getFile: () => currentFile });
    audio.addEventListener('loadedmetadata', () => {
        status.textContent = '已載入音訊，使用下方播放器播放。';
    });
    audio.addEventListener('play', async () => {
        const currentSelection = selection;
        try {
            ensureGraph();
            await context.resume();
            if (currentSelection === selection && !audio.paused) status.textContent = '播放中';
        } catch (error) {
            if (currentSelection === selection) showError('無法啟動音訊：' + error.message);
        }
    });
    audio.addEventListener('pause', () => {
        runtime.deliverLocalAudio(silence);
        if (audio.currentSrc && !audio.error) status.textContent = audio.ended ? '播放結束' : '已暫停';
    });
    audio.addEventListener('seeking', () => runtime.deliverLocalAudio(silence));
    audio.addEventListener('error', () => {
        if (objectURL) showError('無法解碼此音訊。請選擇瀏覽器支援的 WAV、MP3 或 FLAC。');
    });
    window.addEventListener('pagehide', event => {
        audio.pause();
        if (event.persisted) return;
        if (frame !== null) window.cancelAnimationFrame(frame);
        if (objectURL) URL.revokeObjectURL(objectURL);
        if (context) context.close().catch(() => {});
    });

    if (!AudioContextClass) {
        input.disabled = true;
        status.textContent = '此瀏覽器不支援 Web Audio API。';
    }
    frame = window.requestAnimationFrame(tick);
}());

(function () {
    'use strict';
    if (window.VisualizerRuntime.mode !== 'standalone') return;
    // 播放列以真實波形呈現歌曲結構：歌詞時間標記與片尾區段都畫在同一條時間軸上。
    const audio = document.querySelector('#local-audio'), wrap = document.querySelector('#transport-wave');
    const canvas = document.querySelector('#transport-waveform'), seek = document.querySelector('#transport-seek');
    const COLORS = { wave: '#8d887e', played: '#e2a73b', flat: '#4a4742', tick: '#e8e4dc', head: '#e2a73b', tail: '#3f3c38', tailText: '#c9c3b6' };
    let peaks = null, version = 0, base = null, played = null, raf = null;
    function tail() { return window.WaveCanvasExportSettings?.get() ?? 0; }
    function total() { return Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration + tail() : 0; }
    async function analyse(file) {
        const current = ++version; peaks = null; rebuild();
        if (!file) return;
        try {
            const Context = window.OfflineAudioContext, context = new Context(1, 1, 44100);
            const buffer = await context.decodeAudioData(await file.arrayBuffer());
            if (current !== version) return;
            const cache = await window.VisualizerWaveform.build(buffer, () => current !== version);
            if (!cache || current !== version) return;
            // 只保留接近播放列解析度的一層，不必留著完整解碼資料。
            const level = window.VisualizerWaveform.level(cache, buffer.duration / 4000);
            peaks = { min: level.min, max: level.max, seconds: level.stride / buffer.sampleRate };
            rebuild();
        } catch (error) { console.warn('Transport waveform:', error.message); }
    }
    function render(color, width, height, ratio) {
        const layer = document.createElement('canvas'); layer.width = width; layer.height = height;
        const ctx = layer.getContext('2d'), span = total(), step = Math.max(2, Math.round(3 * ratio)), bar = Math.max(1, step - Math.round(ratio));
        const usable = span ? Math.round(width * audio.duration / span) : width, middle = height / 2;
        ctx.fillStyle = peaks ? color : COLORS.flat;
        for (let x = 0; x < usable; x += step) {
            let amount = .03;
            if (peaks) {
                const from = Math.floor(x / usable * audio.duration / peaks.seconds), to = Math.max(from + 1, Math.floor((x + step) / usable * audio.duration / peaks.seconds));
                for (let i = from; i < Math.min(to, peaks.max.length); i++) amount = Math.max(amount, peaks.max[i], -peaks.min[i]);
            }
            const size = Math.max(ratio, Math.min(1, amount) * (height - 8 * ratio));
            ctx.fillRect(x, middle - size / 2, bar, size);
        }
        return layer;
    }
    function rebuild() {
        const box = wrap.getBoundingClientRect(), ratio = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.round(box.width * ratio)), height = Math.max(1, Math.round(box.height * ratio));
        canvas.width = width; canvas.height = height;
        base = render(COLORS.wave, width, height, ratio); played = render(COLORS.played, width, height, ratio);
        // 拖曳範圍只涵蓋音樂本身；片尾只存在於輸出的影片中，預覽無法播放到那裡。
        const span = total(); seek.style.width = span ? audio.duration / span * 100 + '%' : '100%';
        draw();
    }
    function ticks(ctx, width, height, ratio, span) {
        const lyrics = window.VisualizerLyrics, state = lyrics?.getState(); if (!state?.count || !span) return;
        const offset = state.fileOffsetMs + window.VisualizerRuntime.getStandalone().lyrics.globalOffsetMs;
        ctx.fillStyle = COLORS.tick;
        for (let index = 0; index < state.count; index++) {
            const seconds = (lyrics.getEvent(index).timeMs - offset) / 1000;
            if (seconds >= 0 && seconds <= span) ctx.fillRect(Math.round(seconds / span * width), height - 4 * ratio, Math.max(1, ratio), 4 * ratio);
        }
    }
    function draw() {
        if (!base) return;
        const ctx = canvas.getContext('2d'), { width, height } = canvas, ratio = window.devicePixelRatio || 1, span = total();
        ctx.clearRect(0, 0, width, height); ctx.drawImage(base, 0, 0);
        if (!span) return;
        const head = Math.round(Math.min(audio.currentTime, audio.duration) / span * width);
        ctx.drawImage(played, 0, 0, head, height, 0, 0, head, height);
        const seconds = tail();
        if (seconds > 0) {
            const start = Math.round(audio.duration / span * width);
            ctx.fillStyle = COLORS.tail; ctx.fillRect(start, 0, width - start, height);
            if (width - start > 56 * ratio) {
                ctx.fillStyle = COLORS.tailText; ctx.font = 11 * ratio + 'px "Segoe UI Variable","Segoe UI","Microsoft JhengHei UI",sans-serif';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(window.WaveCanvasI18n.t('片尾 {seconds} 秒', { seconds }), start + (width - start) / 2, height / 2);
            }
        }
        ticks(ctx, width, height, ratio, span);
        ctx.fillStyle = COLORS.head; ctx.fillRect(head, 0, Math.max(1, Math.round(ratio)), height);
    }
    function loop() {
        raf = null; draw();
        // 只在實際播放且編輯器可見時持續重繪，暫停時不佔用動畫迴圈。
        if (!audio.paused && !document.hidden && !document.querySelector('#editor-view').hidden) raf = requestAnimationFrame(loop);
    }
    function start() { if (raf === null) raf = requestAnimationFrame(loop); }
    for (const event of ['seeked', 'timeupdate', 'pause', 'ended', 'emptied']) audio.addEventListener(event, draw);
    audio.addEventListener('play', start);
    audio.addEventListener('durationchange', rebuild);
    window.addEventListener('wavecanvas-view-change', () => { rebuild(); if (!audio.paused) start(); });
    document.addEventListener('visibilitychange', () => { if (!audio.paused) start(); });
    window.addEventListener('local-audio-change', () => analyse(window.VisualizerLocalAudio.getFile()));
    window.VisualizerLyrics?.subscribe(draw);
    window.WaveCanvasExportSettings?.subscribe(rebuild);
    window.addEventListener('wavecanvas-language-change', draw);
    new ResizeObserver(rebuild).observe(wrap);
    rebuild();
}());

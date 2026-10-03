(function () {
    'use strict';
    const runtime = window.VisualizerRuntime, motion = window.VisualizerBackgroundMotion;
    const image = document.querySelector('#bgimg'), stage = document.querySelector('#stage');
    const audio = document.querySelector('#local-audio'), editor = document.querySelector('#editor-view');
    const point = { x: 0, y: 0 };
    let settings, active = false, scale = 1, phase = 0, pulse = 0, previous = 0, frame = null, disposed = false;
    function visible() { return !document.hidden && (runtime.mode !== 'standalone' || !editor.hidden); }
    function draw() {
        let x = 0, y = 0, size = scale;
        if (settings.mode === 'infinity') {
            motion.drift(phase, settings.driftAmount, point);
            x = settings.offsetX + point.x; y = settings.offsetY + point.y;
        } else size *= 1 + settings.bassScaleAmount * pulse;
        image.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) scale(' + size + ')';
    }
    function stop() {
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null; previous = 0; image.style.willChange = '';
    }
    function schedule() {
        if (!disposed && active && visible() && frame === null) {
            image.style.willChange = 'transform'; frame = requestAnimationFrame(backgroundFrame);
        }
    }
    function backgroundFrame(time) {
        frame = null;
        if (!active || !visible() || disposed) { stop(); return; }
        const dt = previous ? Math.min(100, Math.max(0, time - previous)) : 0;
        previous = time;
        if (settings.mode === 'infinity') phase = (phase + dt * motion.TAU * settings.driftSpeed / motion.PERIOD_MS) % motion.TAU;
        else {
            const playing = runtime.mode !== 'standalone' || !audio.paused;
            const target = playing ? motion.bass(window.audioSample) : 0;
            // Reuse the existing visual attack/release helper; no new audio processing chain.
            pulse = window.VisualizerLyricsRuntime.envelope(pulse, target, dt, settings.bassAttack, settings.bassRelease);
            if (!playing && pulse < 0.0001) { pulse = 0; draw(); stop(); return; }
        }
        draw(); schedule();
    }
    runtime.subscribe((properties, standalone) => {
        const before = settings?.mode;
        settings = standalone.background;
        if (before !== settings.mode) { pulse = 0; previous = 0; }
        scale = motion.coverage(settings);
        active = settings.enabled && properties.backgroundsource.value === 2 && Boolean(properties.backgroundimage.value);
        image.hidden = !active;
        image.style.backgroundPosition = 'center'; image.style.backgroundSize = 'cover';
        image.style.opacity = settings.opacity; image.style.filter = 'blur(' + settings.blur + 'px)';
        stage.style.backgroundColor = properties.backgroundsource.value === 2 ? settings.backingColor : '';
        draw();
        if (!active) stop(); else schedule();
    });
    function refresh() { if (!visible()) stop(); else schedule(); }
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('wavecanvas-view-change', refresh);
    audio.addEventListener('play', schedule);
    window.addEventListener('pagehide', event => { if (!event.persisted) { disposed = true; stop(); } else stop(); });
    window.addEventListener('pageshow', () => { if (!disposed) refresh(); });
}());

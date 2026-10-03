(function () {
    'use strict';
    const TAU = Math.PI * 2;
    const PERIOD_MS = 60000;
    function drift(phase, amount, output) {
        output.x = amount * Math.sin(phase);
        output.y = amount * 0.45 * Math.sin(phase * 2);
        return output;
    }
    function coverage(settings) {
        const moving = settings.mode === 'infinity';
        const x = moving ? Math.abs(settings.offsetX) + settings.driftAmount : 0;
        const y = moving ? Math.abs(settings.offsetY) + settings.driftAmount * 0.45 : 0;
        // Three blur radii keep the filtered edge outside the canonical stage.
        const padding = settings.blur * 3;
        return Math.max(settings.baseScale, 1 + (x + padding) * 2 / 1920, 1 + (y + padding) * 2 / 1080);
    }
    function bass(samples) {
        let value = 0;
        for (let i = 0; i < 5; i++) {
            const sample = samples[i];
            if (Number.isFinite(sample) && sample > 0) value += sample;
        }
        return Math.min(1, value);
    }
    window.VisualizerBackgroundMotion = Object.freeze({ TAU, PERIOD_MS, drift, coverage, bass });
}());

/* Shared processed-spectrum fixture, independent of the audio pipeline. */
(function () {
    let config = { ...window.VisualizerLayoutSettings.defaults(), layout: 'square', barCount: 64,
        squareSize: 380, height: 240, barWidth: 12, gap: 6, direction: 'outward' };
    let notify;
    window.VisualizerRuntime = { mode: 'standalone', getStandalone: () => ({ visualizer: config }),
        subscribe(callback) { notify = callback; callback({}, { visualizer: config }); } };
    document.addEventListener('DOMContentLoaded', function () {
        const samples = Array.from({ length: 128 }, (_, i) => i < 64
            ? 0.08 + 0.72 * Math.exp(-i / 15) * (0.7 + 0.3 * Math.cos(i * 0.8) ** 2) : 0);
        samples[1] = 0.9;
        const appearance = { bass: { distance: 12 }, shakeX: 0, shakeY: 0, autoRotation: 0,
            logoRotation: 0, centerColor: '#182435', color: index => index < 16 ? '#ffb45b' : index < 64 ? '#67ddd1' : '#6b9eed' };
        for (const mode of ['symmetric', 'topBassMirror', 'foldedDiagonal']) {
            config = { ...config, squareSpectrumLayout: mode }; notify({}, { visualizer: config });
            window.VisualizerGeometry.draw(document.getElementById(mode).getContext('2d'), samples, appearance);
        }
    });
}());

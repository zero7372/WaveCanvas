/* Test fixture: same processed spectrum and appearance for both renderers. */
(function () {
    const config = { ...window.VisualizerLayoutSettings.defaults(), layout: 'square',
        barCount: 64, squareSize: 380, height: 320, barWidth: 12, gap: 6, mirror: 'none', direction: 'outward' };
    window.VisualizerRuntime = { mode: 'standalone', getStandalone: () => ({ visualizer: config }),
        subscribe(callback) { callback({}, { visualizer: config }); } };
    window.drawSquareComparison = function () {
        const samples = Array.from({ length: 128 }, (_, i) => i < 64
            ? 0.035 + 0.7 * Math.exp(-i / 14) * (0.65 + 0.35 * Math.cos(i * 0.9) ** 2) : 0);
        samples[1] = 0.9;
        const appearance = { bass: { center: 0, bars: 0, distance: 12 }, shakeX: 0, shakeY: 0,
            autoRotation: 0, logoRotation: 0, centerColor: '#182435', color: () => '#67ddd1' };
        for (const [id, renderer] of [['before', window.SquareBeforeRenderer], ['after', window.VisualizerGeometry]]) {
            const context = document.getElementById(id).getContext('2d');
            renderer.draw(context, samples, appearance);
        }
    };
}());

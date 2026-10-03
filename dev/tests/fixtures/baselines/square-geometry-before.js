(function () {
    'use strict';
    let settings = window.VisualizerRuntime.getStandalone().visualizer;
    window.VisualizerRuntime.subscribe((_, standalone) => { settings = standalone.visualizer; });
    // Reuse the processed, smoothed first 64 bands. Geometry never reads an AnalyserNode or modifies samples.
    function sampleIndex(index, count, mirror, reverse) {
        let fraction = count <= 1 ? 0 : index / (count - 1);
        if (mirror === 'center') fraction = Math.min(index, count - 1 - index) / Math.max(1, Math.ceil(count / 2) - 1);
        if (reverse) fraction = 1 - fraction;
        return Math.round(fraction * 63);
    }
    function magnitude(samples, index, extent) { return Math.max(0, Number(samples[index]) || 0) * extent; }
    function build(samples, config, bass = {}) {
        const bars = [];
        const count = config.barCount;
        const square = config.layout === 'square';
        const half = config.squareSize / 2 + (bass.center || 0);
        const edge = config.squareSize / 2 + (bass.distance || 0) + (bass.bars || 0);
        const vertical = config.orientation === 'vertical';
        const span = vertical ? config.height : config.width;
        const extent = square ? config.height : vertical ? config.width : config.height;
        const spacingScale = span / (count * config.barWidth + (count - 1) * config.gap);
        const strokeWidth = square ? Math.min(config.barWidth, 8 * edge / count * config.barWidth / (config.barWidth + config.gap))
            : config.barWidth * spacingScale;
        const pitch = (config.barWidth + config.gap) * spacingScale;
        const anchor = config.anchor === 'start' ? 0 : config.anchor === 'end' ? -span : -span / 2;
        for (let index = 0; index < count; index++) {
            const frequency = sampleIndex(index, count, config.mirror, config.reverse);
            const length = magnitude(samples, frequency, extent);
            let x, y, nx, ny;
            if (square) {
                const perimeter = (index + 0.5) * 4 / count;
                const side = Math.floor(perimeter);
                const t = (perimeter - side) * 2 * edge - edge;
                if (side === 0) { x = t; y = -edge; nx = 0; ny = -1; }
                if (side === 1) { x = edge; y = t; nx = 1; ny = 0; }
                if (side === 2) { x = -t; y = edge; nx = 0; ny = 1; }
                if (side === 3) { x = -edge; y = -t; nx = -1; ny = 0; }
            } else {
                const along = anchor + strokeWidth / 2 + index * pitch;
                x = vertical ? 0 : along; y = vertical ? along : 0;
                nx = vertical ? 1 : 0; ny = vertical ? 0 : -1;
            }
            const sign = square ? (config.direction === 'inward' ? -1 : 1)
                : config.amplitudeDirection === 'negative' ? -1 : 1;
            bars.push({ x, y, nx, ny, length: length * sign, width: strokeWidth, frequency, colorIndex: index * 127 / (count - 1) });
            if (config.mirror === 'dual' || (!square && config.amplitudeDirection === 'both')) {
                bars.push({ x, y, nx, ny, length: -length * sign, width: strokeWidth, frequency, colorIndex: index * 127 / (count - 1) });
            }
        }
        return { bars, half };
    }
    function draw(ctx, samples, appearance) {
        const config = settings;
        const geometry = build(samples, config, appearance.bass);
        ctx.save();
        ctx.translate(1920 * config.positionX / 100 + appearance.shakeX, 1080 * config.positionY / 100 + appearance.shakeY);
        ctx.rotate((config.rotation + (config.layout === 'square' ? appearance.autoRotation : 0)) * Math.PI / 180);
        if (config.layout === 'square') {
            if (appearance.second) {
                const outer = config.squareSize / 2 + appearance.secondRadius;
                ctx.fillStyle = appearance.secondColor;
                ctx.fillRect(-outer, -outer, 2 * outer, 2 * outer);
            }
            const half = geometry.half;
            ctx.save(); ctx.beginPath(); ctx.rect(-half, -half, 2 * half, 2 * half); ctx.clip();
            if (appearance.image) {
                ctx.rotate(appearance.logoRotation * Math.PI / 180);
                ctx.drawImage(appearance.image, -half, -half, 2 * half, 2 * half);
            } else { ctx.fillStyle = appearance.centerColor; ctx.fillRect(-half, -half, 2 * half, 2 * half); }
            ctx.restore();
        }
        // Draw bars after the center so inward bars remain visible over the square/cover.
        for (const bar of geometry.bars) {
            ctx.beginPath(); ctx.moveTo(bar.x, bar.y);
            ctx.lineTo(bar.x + bar.nx * bar.length, bar.y + bar.ny * bar.length);
            ctx.strokeStyle = appearance.color(bar.colorIndex);
            ctx.lineWidth = bar.width; ctx.stroke();
        }
        ctx.restore();
    }
    window.VisualizerGeometry = Object.freeze({
        active: () => window.VisualizerRuntime.mode === 'standalone' && settings.layout !== 'circle',
        getSettings: () => ({ ...settings }), sampleIndex, magnitude, build, draw
    });
}());

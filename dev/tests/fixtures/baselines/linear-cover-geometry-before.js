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
    function buildSquare(samples, config, bass) {
        const bars = [];
        const half = config.squareSize / 2 + (bass.center || 0);
        const edge = config.squareSize / 2 + (bass.distance || 0) + (bass.bars || 0);
        // barCount is the whole frame budget; every side receives the same count.
        const perSide = Math.max(1, Math.round(config.barCount / 4));
        const spectrumLayout = config.squareSpectrumLayout || 'symmetric';
        const halfSide = Math.ceil(perSide / 2);
        const groups = spectrumLayout === 'topBassMirror' ? perSide + 2 * halfSide
            : spectrumLayout === 'foldedDiagonal' ? perSide : halfSide;
        const peaks = new Array(groups);
        for (let group = 0; group < groups; group++) {
            const start = Math.floor(group * 64 / groups);
            const end = Math.floor((group + 1) * 64 / groups);
            let peak = 0;
            for (let bin = start; bin < end; bin++) {
                const value = samples[bin];
                if (Number.isFinite(value) && value > peak) peak = value;
            }
            peaks[group] = peak * config.height;
        }
        const slot = 2 * edge / perSide;
        const ratio = config.barWidth / (config.barWidth + config.gap);
        const initialWidth = Math.min(config.barWidth, slot * ratio);
        const cornerInset = Math.min(edge * 0.45, Math.max(slot / 2, initialWidth / 2 + config.gap / 2));
        const span = 2 * (edge - cornerInset);
        const pitch = perSide > 1 ? span / (perSide - 1) : span;
        const strokeWidth = Math.min(config.barWidth, pitch * ratio, cornerInset * 1.8);
        const sign = config.direction === 'inward' ? -1 : 1;
        for (let side = 0; side < 4; side++) {
            for (let index = 0; index < perSide; index++) {
                let group;
                if (spectrumLayout === 'topBassMirror') {
                    // Two continuous paths: top center -> side -> bottom center.
                    if (side === 0) group = Math.floor(Math.abs(index - (perSide - 1) / 2));
                    else if (side === 1) group = halfSide + index;
                    else if (side === 2) group = halfSide + perSide + Math.min(index, perSide - 1 - index);
                    else group = halfSide + perSide - 1 - index;
                } else if (spectrumLayout === 'foldedDiagonal') {
                    // Fold each adjacent-edge pair at its shared corner: TR / BL.
                    // Clockwise traversal is high -> low -> high, with no edge restart.
                    group = side === 0 || side === 3 ? perSide - 1 - index : index;
                } else group = Math.floor(Math.abs(index - (perSide - 1) / 2));
                if (config.reverse) group = groups - 1 - group;
                const frequencyStart = Math.floor(group * 64 / groups);
                const frequencyEnd = Math.floor((group + 1) * 64 / groups) - 1;
                const frequency = (frequencyStart + frequencyEnd) / 2;
                const along = perSide === 1 ? 0 : -span / 2 + index * pitch;
                let x, y, nx, ny;
                if (side === 0) { x = along; y = -edge; nx = 0; ny = -1; }
                if (side === 1) { x = edge; y = along; nx = 1; ny = 0; }
                if (side === 2) { x = along; y = edge; nx = 0; ny = 1; }
                if (side === 3) { x = -edge; y = along; nx = -1; ny = 0; }
                bars.push({ x, y, nx, ny, length: peaks[group] * sign, width: strokeWidth,
                    frequency, frequencyStart, frequencyEnd, group, colorIndex: frequency * 127 / 63 });
            }
        }
        return { bars, half, perSide };
    }
    function build(samples, config, bass = {}) {
        if (config.layout === 'square') return buildSquare(samples, config, bass);
        const bars = [];
        const count = config.barCount;
        const half = config.squareSize / 2 + (bass.center || 0);
        const vertical = config.orientation === 'vertical';
        const span = vertical ? config.height : config.width;
        const extent = vertical ? config.width : config.height;
        const spacingScale = span / (count * config.barWidth + (count - 1) * config.gap);
        const strokeWidth = config.barWidth * spacingScale;
        const pitch = (config.barWidth + config.gap) * spacingScale;
        const anchor = config.anchor === 'start' ? 0 : config.anchor === 'end' ? -span : -span / 2;
        for (let index = 0; index < count; index++) {
            const frequency = sampleIndex(index, count, config.mirror, config.reverse);
            const length = magnitude(samples, frequency, extent);
            const along = anchor + strokeWidth / 2 + index * pitch;
            const x = vertical ? 0 : along, y = vertical ? along : 0;
            const nx = vertical ? 1 : 0, ny = vertical ? 0 : -1;
            const sign = config.amplitudeDirection === 'negative' ? -1 : 1;
            bars.push({ x, y, nx, ny, length: length * sign, width: strokeWidth, frequency, colorIndex: index * 127 / (count - 1) });
            if (config.mirror === 'dual' || config.amplitudeDirection === 'both') {
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
        const squareColors = config.layout === 'square' ? [] : null;
        for (const bar of geometry.bars) {
            if (squareColors) {
                // One color per shared band also keeps beat-random colors symmetric.
                if (squareColors[bar.group] === undefined) squareColors[bar.group] = appearance.color(bar.colorIndex);
                ctx.fillStyle = squareColors[bar.group];
                const endX = bar.x + bar.nx * bar.length, endY = bar.y + bar.ny * bar.length;
                if (bar.nx === 0) ctx.fillRect(bar.x - bar.width / 2, Math.min(bar.y, endY), bar.width, Math.abs(bar.length));
                else ctx.fillRect(Math.min(bar.x, endX), bar.y - bar.width / 2, Math.abs(bar.length), bar.width);
                continue;
            }
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

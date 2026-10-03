(function () {
    'use strict';
    const number = (text, value, min, max, step = 1) => ({ type: 'slider', text, value, min, max, step });
    const combo = (text, value, options) => ({ type: 'combo', text, value, options: options.map(([value, label]) => ({ value, label })) });
    const properties = {
        layout: combo('Layout', 'circle', [['circle', 'Radial Circle'], ['square', 'Radial Square'], ['linear', 'Linear']]),
        squareSpectrumLayout: combo('Square Spectrum Layout', 'symmetric', [['symmetric', 'Symmetric'], ['topBassMirror', 'Top Bass Mirror'], ['foldedDiagonal', 'Folded Diagonal']]),
        orientation: combo('Orientation', 'horizontal', [['horizontal', 'Horizontal'], ['vertical', 'Vertical']]),
        positionX: number('Position X (%)', 50, 0, 100, 0.1),
        positionY: number('Position Y (%)', 50, 0, 100, 0.1),
        width: number('Width (stage px)', 900, 1, 1920),
        height: number('Height (stage px)', 180, 1, 1080),
        rotation: number('Rotation (°)', 0, -180, 180, 0.1),
        barCount: number('Bar count', 64, 4, 128),
        barWidth: number('Bar width', 8, 1, 80),
        gap: number('Gap weight', 4, 0, 80),
        mirror: combo('Mirror', 'none', [['none', 'None'], ['center', 'Mirror Around Center'], ['dual', 'Dual Opposite']]),
        reverse: { type: 'bool', text: 'Reverse frequency direction', value: false },
        direction: combo('Square direction', 'outward', [['outward', 'Outward'], ['inward', 'Inward']]),
        amplitudeDirection: combo('Amplitude direction', 'positive', [['positive', 'Up / Right'], ['negative', 'Down / Left'], ['both', 'Both sides']]),
        anchor: combo('Position anchor', 'center', [['start', 'Start'], ['center', 'Center'], ['end', 'End']]),
        squareSize: number('Square size (stage px)', 256, 8, 1080)
    };
    function defaults() { return Object.fromEntries(Object.entries(properties).map(([key, field]) => [key, field.value])); }
    function normalize(patch, base = defaults()) {
        if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('visualizer 必須是設定物件');
        const result = { ...base };
        for (const [key, field] of Object.entries(properties)) {
            if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
            let value = patch[key];
            if (field.type === 'slider') {
                if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(key + ' 必須是有限數值');
                value = Math.min(field.max, Math.max(field.min, value));
                if (field.step === 1) value = Math.round(value);
            } else if (field.type === 'bool') {
                if (typeof value !== 'boolean') throw new TypeError(key + ' 必須是布林值');
            } else if (!field.options.some(option => option.value === value)) throw new TypeError(key + ' 選項無效');
            result[key] = value;
        }
        return result;
    }
    window.VisualizerLayoutSettings = Object.freeze({ properties, defaults, normalize });
}());

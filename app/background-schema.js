(function () {
    'use strict';
    const slider = (text, value, min, max, step = 1) => ({ type: 'slider', text, value, min, max, step });
    const properties = {
        enabled: { type: 'bool', text: '啟用背景圖片', value: true },
        mode: { type: 'combo', text: '背景動作模式', value: 'infinity', options: [
            { value: 'infinity', label: '無限漂移 · Infinity Drift' },
            { value: 'bassPulse', label: '低頻脈動 · Bass Pulse' }
        ] },
        baseScale: slider('基礎縮放', 1.08, 1, 2, 0.01),
        driftAmount: { ...slider('漂移幅度（畫布像素）', 18, 0, 60), mode: 'infinity' },
        driftSpeed: { ...slider('漂移速度（1× = 每圈 60 秒）', 1, 0.25, 2, 0.05), mode: 'infinity' },
        bassScaleAmount: { ...slider('低頻額外縮放比例', 0.035, 0, 0.1, 0.005), mode: 'bassPulse' },
        bassAttack: { ...slider('低頻放大平滑時間（毫秒）', 140, 20, 2000), mode: 'bassPulse' },
        bassRelease: { ...slider('低頻回復平滑時間（毫秒）', 850, 100, 5000), mode: 'bassPulse' },
        offsetX: slider('圖片水平移動（畫布像素）', 0, -1920, 1920),
        offsetY: slider('圖片垂直移動（畫布像素）', 0, -1080, 1080),
        opacity: slider('圖片不透明度', 1, 0, 1, 0.01),
        blur: slider('圖片模糊（畫布像素）', 0, 0, 80),
        backingColor: { type: 'color', text: '圖片後方底色', value: '#000000' }
    };
    properties.offsetX.mode = properties.offsetY.mode = 'infinity';
    function defaults() { return Object.fromEntries(Object.entries(properties).map(([key, field]) => [key, field.value])); }
    function normalize(patch, base = defaults()) {
        if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('圖片背景設定必須是物件。');
        const result = { ...base };
        for (const [key, field] of Object.entries(properties)) {
            if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
            let value = patch[key];
            if (field.type === 'slider') {
                if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(field.text + '必須是有限數值。');
                value = Math.min(field.max, Math.max(field.min, value));
                if (field.step === 1) value = Math.round(value);
            } else if (field.type === 'bool') {
                if (typeof value !== 'boolean') throw new TypeError(field.text + '必須是布林值。');
            } else if (field.type === 'combo') {
                // Historical modes never reactivate the removed image rotation system.
                if (value === 'slideshow') value = field.value;
                if (!field.options.some(option => option.value === value)) throw new TypeError(field.text + '選項無效。');
            } else if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) throw new TypeError('圖片後方底色格式無效。');
            result[key] = value;
        }
        return result;
    }
    window.VisualizerBackgroundSettings = Object.freeze({ properties, defaults, normalize });
}());

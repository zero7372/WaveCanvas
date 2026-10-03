(function () {
    'use strict';
    const slider = (text, value, min, max, step = 1) => ({ type: 'slider', text, value, min, max, step });
    const properties = {
        enabled: { type: 'bool', text: '啟用歌曲資訊', value: true },
        title: { type: 'string', text: '曲名', value: 'Song Title' },
        artist: { type: 'string', text: '作者', value: 'Artist' },
        fontFamily: { type: 'combo', text: '字型', value: 'system-ui', options: window.VisualizerSystemFonts.options },
        alignment: { type: 'combo', text: '對齊', value: 'center', options: [{ value: 'left', label: '靠左' }, { value: 'center', label: '置中' }, { value: 'right', label: '靠右' }] },
        positionX: slider('水平位置（%）', 50, 0, 100, 0.1), positionY: slider('垂直位置（%）', 62, 0, 100, 0.1),
        scale: slider('整體縮放', 1, 0.25, 4, 0.05), lineGap: slider('行間距（畫布像素）', 10, 0, 120),
        titleSizeRatio: slider('曲名字號比例', 1, 0.5, 2, 0.05), artistSizeRatio: slider('作者字號比例', 0.65, 0.3, 1.5, 0.05),
        color: { type: 'color', text: '文字顏色', value: '#ffffff' },
        borderEnabled: { type: 'bool', text: '啟用邊框／外發光', value: true },
        borderColor: { type: 'color', text: '邊框顏色', value: '#000000' },
        borderWidth: slider('邊框粗細（畫布像素）', 1, 0, 8, 0.25), borderBlur: slider('邊框模糊（畫布像素）', 0, 0, 40),
        bassReaction: { type: 'bool', text: '啟用低頻反應', value: false },
        bassStrength: slider('低頻強度', 80, 0, 640)
    };
    function defaults() { return Object.fromEntries(Object.entries(properties).map(([key, field]) => [key, field.value])); }
    function normalize(patch, base = defaults()) {
        if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('歌曲資訊設定必須是物件。');
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
            } else if (field.type === 'color') {
                if (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value)) throw new TypeError(field.text + '必須是 HEX 顏色。');
                value = value.toLowerCase();
            } else if (field.type === 'string') {
                if (typeof value !== 'string') throw new TypeError(field.text + '必須是文字。');
                value = value.slice(0, 500);
            } else if (key === 'fontFamily') {
                if (typeof value !== 'string') throw new TypeError('字型必須是文字。');
                value = window.VisualizerSystemFonts.normalize(value);
            }
            else if (!field.options.some(option => option.value === value)) throw new TypeError(field.text + '選項無效。');
            result[key] = value;
        }
        return result;
    }
    function bassScale(samples, settings) {
        let bass = 0;
        if (settings.bassReaction && samples) for (let i = 0; i < 5; i++) bass += Math.max(0, Number.isFinite(samples[i]) ? samples[i] : 0);
        // Preserve the original Text expression: 1 + sum(first five bins) * (strength / 8) / 80.
        return 1 + bass * settings.bassStrength / 640;
    }
    window.VisualizerSongInfoSettings = Object.freeze({ properties, defaults, normalize, bassScale });
}());

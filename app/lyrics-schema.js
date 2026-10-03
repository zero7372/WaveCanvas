(function () {
    'use strict';
    const number = (text, value, min, max, step = 1) => ({ type: 'slider', text, value, min, max, step });
    const bool = (text, value) => ({ type: 'bool', text, value });
    const color = (text, value) => ({ type: 'color', text, value });
    const combo = (text, value, options) => ({ type: 'combo', text, value, options: options.map(([value, label]) => ({ value, label })) });
    const fallback = window.VisualizerSystemFonts.fallback;
    const properties = {
        enabled: bool('啟用歌詞', true),
        fontFamily: combo('字型', 'system-ui', window.VisualizerSystemFonts.options.map(option => [option.value, option.label])),
        fontSize: number('字型大小（畫布像素）', 48, 18, 96),
        fontWeight: combo('字重', 600, [[400, '標準'], [500, '中等'], [600, '半粗體'], [700, '粗體'], [800, '特粗體']]),
        currentColor: color('目前句顏色', '#ffffff'), inactiveColor: color('上下句顏色', '#c3ccd8'),
        inactiveOpacity: number('上下句不透明度', 0.58, 0.15, 0.9, 0.01),
        positionX: number('水平位置（%）', 50, 0, 100, 0.1), positionY: number('垂直位置（%）', 75, 0, 100, 0.1),
        maxWidth: number('最大寬度（畫布像素）', 1100, 128, 1792), lineSpacing: number('行間距（畫布像素）', 30, 0, 120),
        textAlign: combo('文字對齊', 'center', [['left', '靠左'], ['center', '置中'], ['right', '靠右']]),
        showPrevious: bool('顯示上一句', true), showNext: bool('顯示下一句', true),
        transitionDuration: number('焦點切換時間（毫秒）', 650, 0, 1500), transitionOvershoot: number('微幅越界（畫布像素）', 4, 0, 12, 0.5),
        inactiveBlur: number('上下句模糊（畫布像素）', 0.5, 0, 3, 0.1),
        glowEnabled: bool('啟用目前句背光', true),
        glowColorMode: combo('背光顏色模式', 'text', [['text', '跟隨文字顏色'], ['custom', '自訂顏色']]),
        glowColor: color('自訂背光顏色', '#92cfff'), glowBaseOpacity: number('基本背光強度', 0.24, 0, 0.6, 0.01),
        glowMaxOpacity: number('最大背光強度', 0.56, 0, 1, 0.01), glowBlur: number('背光模糊（畫布像素）', 18, 0, 60),
        glowSpread: number('背光擴散倍率', 1.025, 1, 1.15, 0.005),
        glowBassSensitivity: number('低頻靈敏度', 0.5, 0, 4, 0.05), glowAttack: number('背光上升時間（毫秒）', 90, 10, 1000),
        glowRelease: number('背光衰減時間（毫秒）', 450, 10, 2000), globalOffsetMs: number('歌詞時間偏移（毫秒）', 0, -5000, 5000),
        secondaryEnabled: bool('顯示次要歌詞', true),
        secondaryFontFamily: combo('次要歌詞字型', 'system-ui', window.VisualizerSystemFonts.options.map(option => [option.value, option.label])),
        secondaryFontSizeRatio: number('次要歌詞字號比例', 0.65, 0.4, 0.85, 0.01),
        secondaryFontWeight: combo('次要歌詞字重', 400, [[400, '標準'], [500, '中等'], [600, '半粗體'], [700, '粗體']]),
        secondaryColor: color('次要歌詞顏色', '#d7dfeb'), secondaryOpacity: number('次要歌詞不透明度', 0.70, 0.2, 1, 0.01),
        secondaryGap: number('雙語間距（畫布像素）', 8, 0, 40),
        secondaryPosition: combo('次要歌詞位置', 'below', [['below', '主要歌詞下方'], ['above', '主要歌詞上方']]),
        mergeToleranceMs: number('雙檔配對容差（毫秒）', 100, 0, 1000),
        secondaryOffsetMs: number('次要歌詞時間校準（毫秒）', 0, -2000, 2000)
    };
    function defaults() { return Object.fromEntries(Object.entries(properties).map(([key, field]) => [key, field.value])); }
    function normalize(patch, base = defaults()) {
        if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('歌詞設定必須是物件。');
        const result = { ...base };
        for (const [key, field] of Object.entries(properties)) {
            if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
            let value = patch[key];
            if (field.type === 'slider') {
                if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(field.text + '必須是有限數值。');
                value = Math.min(field.max, Math.max(field.min, value));
                if (field.step === 1) value = Math.round(value);
            } else if (field.type === 'color') {
                if (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value)) throw new TypeError(field.text + '必須是 HEX 顏色。');
                value = value.toLowerCase();
            } else if (field.type === 'bool') {
                if (typeof value !== 'boolean') throw new TypeError(field.text + '必須是布林值。');
            } else if (key === 'fontFamily' || key === 'secondaryFontFamily') {
                if (typeof value !== 'string') throw new TypeError('字型必須是文字。');
                value = window.VisualizerSystemFonts.normalize(value);
            }
            else if (!field.options.some(option => option.value === value)) throw new TypeError(field.text + '選項無效。');
            result[key] = value;
        }
        result.glowMaxOpacity = Math.max(result.glowBaseOpacity, result.glowMaxOpacity);
        return result;
    }
    window.VisualizerLyricsSettings = Object.freeze({ properties, defaults, normalize, fallback,
        fontStack: window.VisualizerSystemFonts.fontStack
    });
}());

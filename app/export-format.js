(function (root, factory) {
    'use strict';
    const format = factory();
    if (typeof module === 'object' && module.exports) module.exports = format;
    else root.WaveCanvasExportFormat = format;
}(typeof window === 'object' ? window : globalThis, function () {
    'use strict';
    // 畫布固定是 1920×1080。render 是輸出視窗的像素倍率，output 是寫進影片的尺寸。
    // 720p 由 1080p 畫面縮小；4K 用 2 倍像素重新繪製，文字與圖片是真的 4K，Canvas 圖形由 1080p 放大。
    const resolutions = Object.freeze({
        '720p': Object.freeze({ scale: 1, width: 1280, height: 720 }),
        '1080p': Object.freeze({ scale: 1, width: 1920, height: 1080 }),
        '2160p': Object.freeze({ scale: 2, width: 3840, height: 2160 })
    });
    const rates = Object.freeze([30, 60]);
    const presets = Object.freeze(['veryfast', 'faster', 'medium', 'slow']);
    // 1.1 以前的輸出：1080p、60 fps、medium。舊專案省略這些欄位，輸出維持不變。
    const defaults = Object.freeze({ resolution: '1080p', fps: 60, preset: 'medium' });
    // 虛擬時鐘與音訊分析固定以 60 fps 前進；30 fps 只是每兩格編碼一格。
    const CLOCK_RATE = 60;
    function valid(key, value) {
        if (key === 'resolution') return Object.hasOwn(resolutions, value);
        if (key === 'fps') return rates.includes(value);
        if (key === 'preset') return presets.includes(value);
        return false;
    }
    function resolve(settings) {
        const result = { ...defaults };
        for (const key of Object.keys(defaults)) if (settings && valid(key, settings[key])) result[key] = settings[key];
        const size = resolutions[result.resolution];
        return Object.freeze({ ...result, ...size, step: CLOCK_RATE / result.fps, renderWidth: 1920 * size.scale, renderHeight: 1080 * size.scale });
    }
    // 專案只存和預設不同的欄位，未改設定的專案檔維持 1.1 的內容。
    function compact(settings) {
        const result = {};
        for (const key of Object.keys(defaults)) if (settings && valid(key, settings[key]) && settings[key] !== defaults[key]) result[key] = settings[key];
        return result;
    }
    return Object.freeze({ resolutions, rates, presets, defaults, CLOCK_RATE, valid, resolve, compact });
}));

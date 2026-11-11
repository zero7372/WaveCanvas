(function () {
    'use strict';
    const DEFAULT_TAIL_SECONDS = 2;
    const model = window.WaveCanvasProjectModel, formats = window.WaveCanvasExportFormat, subscribers = new Set();
    let tailSeconds = DEFAULT_TAIL_SECONDS, format = { ...formats.defaults };
    function notify() { for (const callback of subscribers) callback(tailSeconds); }
    function assign(value) {
        // 與專案驗證共用同一套範圍與 0.5 秒級距。
        const next = Math.round(Math.min(model.MAX_TAIL_SECONDS, Math.max(0, value)) * 2) / 2;
        if (next === tailSeconds) return;
        tailSeconds = next;
        notify();
    }
    function assignFormat(value) {
        const next = { ...formats.defaults, ...formats.compact(value) };
        if (Object.keys(next).every(key => next[key] === format[key])) return;
        format = next;
        notify();
    }
    window.WaveCanvasExportSettings = Object.freeze({
        get: () => tailSeconds,
        set(value) { if (Number.isFinite(value)) assign(value); },
        // 解析度、影格率與編碼速度；無效的值會被忽略。
        getFormat: () => ({ ...format }),
        setFormat(value) { assignFormat({ ...format, ...Object.fromEntries(Object.entries(value || {}).filter(([key, item]) => formats.valid(key, item))) }); },
        reset() { assign(DEFAULT_TAIL_SECONDS); assignFormat(formats.defaults); },
        // 舊專案沒有輸出設定，還原為 0 秒、1080p、60 fps，避免重新輸出時改變。
        restore(settings) { assign(settings?.tailSeconds ?? 0); assignFormat(settings || formats.defaults); },
        capture: () => ({ tailSeconds, ...formats.compact(format) }),
        subscribe(callback) { subscribers.add(callback); callback(tailSeconds); return () => subscribers.delete(callback); }
    });
}());

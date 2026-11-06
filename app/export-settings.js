(function () {
    'use strict';
    const DEFAULT_TAIL_SECONDS = 2;
    const model = window.WaveCanvasProjectModel, subscribers = new Set();
    let tailSeconds = DEFAULT_TAIL_SECONDS;
    function assign(value) {
        // 與專案驗證共用同一套範圍與 0.5 秒級距。
        const next = Math.round(Math.min(model.MAX_TAIL_SECONDS, Math.max(0, value)) * 2) / 2;
        if (next === tailSeconds) return;
        tailSeconds = next;
        for (const callback of subscribers) callback(tailSeconds);
    }
    window.WaveCanvasExportSettings = Object.freeze({
        get: () => tailSeconds,
        set(value) { if (Number.isFinite(value)) assign(value); },
        reset() { assign(DEFAULT_TAIL_SECONDS); },
        // 舊專案沒有輸出設定，還原為 0 秒，避免重新輸出時長度改變。
        restore(settings) { assign(settings?.tailSeconds ?? 0); },
        capture: () => ({ tailSeconds }),
        subscribe(callback) { subscribers.add(callback); callback(tailSeconds); return () => subscribers.delete(callback); }
    });
}());

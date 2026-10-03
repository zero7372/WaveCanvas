(function (root, factory) {
    const create = factory(); if (typeof module === 'object' && module.exports) module.exports = create;
    else root.WaveCanvasAutosaveScheduler = create;
}(typeof window === 'object' ? window : globalThis, function () {
    'use strict';
    return function create(callback, timers = globalThis) {
        let timer = null, key = null, disposed = false;
        function stop() { if (timer !== null) timers.clearInterval(timer); timer = null; }
        return { configure(settings) {
            if (disposed) return;
            const next = settings.autosaveEnabled ? settings.autosaveIntervalMinutes : null;
            if (next === key) return; stop(); key = next;
            if (next !== null) timer = timers.setInterval(callback, next * 60 * 1000);
        }, dispose() { stop(); disposed = true; } };
    };
}));

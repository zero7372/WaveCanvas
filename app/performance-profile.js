(function () {
    'use strict';
    if (new URLSearchParams(location.search).get('profile') !== '1') return;
    // Development only. Bounded counters, no frame history or retained media/DOM.
    const nativeRAF = window.requestAnimationFrame.bind(window), nativeCancel = window.cancelAnimationFrame.bind(window);
    const pending = new Map(), labels = new WeakMap(), urls = new Set(), listenerSets = new WeakMap();
    const addListener = EventTarget.prototype.addEventListener, removeListener = EventTarget.prototype.removeEventListener;
    let duplicateListenerAttempts = 0, audioGraphs = 0;
    // Weak target keys: diagnostics must not keep detached lyric nodes alive.
    EventTarget.prototype.addEventListener = function (type, listener, options) {
        if (listener) {
            const key = type + ':' + !!(typeof options === 'boolean' ? options : options?.capture);
            let target = listenerSets.get(this); if (!target) listenerSets.set(this, target = new Map());
            let entries = target.get(key); if (!entries) target.set(key, entries = new Set());
            if (entries.has(listener)) duplicateListenerAttempts++;
            entries.add(listener);
        }
        return addListener.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
        const key = type + ':' + !!(typeof options === 'boolean' ? options : options?.capture);
        listenerSets.get(this)?.get(key)?.delete(listener);
        return removeListener.call(this, type, listener, options);
    };
    // Registration counts: native once/AbortSignal removals are not intercepted.
    function listeners(target) { return Object.fromEntries([...(listenerSets.get(target) || [])].map(([key, entries]) => [key, entries.size])); }
    let stats, lastFrame = null, currentLoop = '', overlay, interval, observer;
    const detail = new URLSearchParams(location.search).get('profileDetail') === '1';
    function reset() {
        stats = { started: performance.now(), frames: 0, elapsed: 0, maxFrame: 0, currentFrame: 0, longFrames: 0, droppedEstimate: 0, hiddenFrames: 0, longTasks: 0, longTaskMs: 0, measures: {}, canvas: {}, urlCreated: 0, urlRevoked: 0 };
        lastFrame = null;
    }
    reset();
    function record(name, milliseconds) {
        const entry = stats.measures[name] || (stats.measures[name] = { calls: 0, totalMs: 0, maxMs: 0 });
        entry.calls++; entry.totalMs += milliseconds; entry.maxMs = Math.max(entry.maxMs, milliseconds);
    }
    function wrap(name, fn) {
        return function (...args) {
            const start = performance.now();
            try { return fn.apply(this, args); } finally { record(name, performance.now() - start); }
        };
    }
    function label(fn) {
        if (!labels.has(fn)) {
            const source = Function.prototype.toString.call(fn);
            labels.set(fn, fn.name === 'run' ? 'visualizer' : fn.name === 'runFrame' ? 'timing.frame' : fn.name === 'backgroundFrame' ? 'background.frame' : source.includes('getFloatFrequencyData') ? 'audio.frame' : source.includes('bassEnvelope') ? 'lyrics.frame' : source.includes('draw();') && source.includes('frame =') ? 'song-info.frame' : fn.name || 'anonymous');
        }
        return labels.get(fn);
    }
    window.requestAnimationFrame = fn => {
        const name = label(fn);
        const id = nativeRAF(function (timestamp) {
            pending.delete(id);
            if (name === 'visualizer') {
                if (document.hidden) { stats.hiddenFrames++; lastFrame = null; }
                else {
                    if (lastFrame !== null) {
                        const delta = timestamp - lastFrame;
                        if (delta > 0) {
                            stats.frames++; stats.elapsed += delta; stats.currentFrame = delta; stats.maxFrame = Math.max(stats.maxFrame, delta);
                            // Allow refresh-clock jitter; a missed 60-Hz deadline is >25 ms.
                            if (delta > 25) stats.longFrames++;
                            stats.droppedEstimate += Math.max(0, Math.round(delta / (1000 / 60)) - 1);
                        }
                    }
                    lastFrame = timestamp;
                }
            }
            const previous = currentLoop, start = performance.now(); currentLoop = name;
            try { fn.call(this, timestamp); } finally { currentLoop = previous; record(name, performance.now() - start); }
        });
        pending.set(id, name); return id;
    };
    window.cancelAnimationFrame = id => { pending.delete(id); nativeCancel(id); };
    const createURL = URL.createObjectURL.bind(URL), revokeURL = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = object => { const url = createURL(object); urls.add(url); stats.urlCreated++; return url; };
    URL.revokeObjectURL = url => { if (urls.delete(url)) stats.urlRevoked++; return revokeURL(url); };
    if (window.AnalyserNode) AnalyserNode.prototype.getFloatFrequencyData = wrap('audio.analyser', AnalyserNode.prototype.getFloatFrequencyData);
    if (window.AudioContext) {
        const createSource = AudioContext.prototype.createMediaElementSource;
        AudioContext.prototype.createMediaElementSource = function (...args) { audioGraphs++; return createSource.apply(this, args); };
    }
    if (window.HTMLImageElement?.prototype.decode) HTMLImageElement.prototype.decode = wrap('image.decode', HTMLImageElement.prototype.decode);
    if (detail && window.CanvasRenderingContext2D) {
        for (const method of ['clearRect','drawImage','stroke','fill','save','restore','createLinearGradient','createRadialGradient']) {
            const original = CanvasRenderingContext2D.prototype[method];
            CanvasRenderingContext2D.prototype[method] = function (...args) {
                const start = performance.now();
                try { return original.apply(this, args); } finally {
                    const key = (this.canvas.id || 'other') + '.' + method;
                    stats.canvas[key] = (stats.canvas[key] || 0) + 1;
                    record(key, performance.now() - start);
                }
            };
        }
    }
    function wrapExports() {
        for (const name of ['Particle','ParticlesStyle2']) {
            const constructor = window[name];
            if (!constructor || constructor.prototype.__profiled) continue;
            for (const method of ['draw','update']) if (constructor.prototype[method]) constructor.prototype[method] = wrap(name + '.' + method, constructor.prototype[method]);
            Object.defineProperty(constructor.prototype, '__profiled', { value: true });
        }
        for (const [globalName, methods] of [['VisualizerRuntime',['deliverLocalAudio']], ['VisualizerGeometry',['build','draw']], ['VisualizerLRC',['activeIndex','parse']], ['VisualizerImages',['load']], ['VisualizerStage',['fit','resizeCanvas']]]) {
            const original = window[globalName]; if (!original || original.__profiled) continue;
            const copy = { ...original, __profiled: true };
            for (const method of methods) if (typeof original[method] === 'function') copy[method] = wrap(globalName + '.' + method, original[method]);
            window[globalName] = Object.freeze(copy);
        }
        const adapter = window.VisualizerAudioAdapter;
        if (adapter && !adapter.__profiled) window.VisualizerAudioAdapter = Object.freeze({ ...adapter, __profiled: true,
            createSpectrumMapper(...args) { const mapper = adapter.createSpectrumMapper(...args); return Object.freeze({ ...mapper, map: wrap('audio.mapping', mapper.map) }); }
        });
        const wave = window.VisualizerWaveform;
        if (wave && !wave.__profiled) window.VisualizerWaveform = Object.freeze({ ...wave, __profiled: true,
            async build(...args) { const start = performance.now(); try { return await wave.build(...args); } finally { record('waveform.build.elapsed', performance.now() - start); } }
        });
    }
    function snapshot() {
        const audio = document.querySelector('#local-audio'), stage = document.querySelector('#stage');
        const rect = stage?.getBoundingClientRect();
        const measures = Object.fromEntries(Object.entries(stats.measures).map(([name, entry]) => [name, { ...entry, averageMs: entry.totalMs / entry.calls }]));
        return { ...stats, canvas: { ...stats.canvas }, measures, durationMs: performance.now() - stats.started,
            currentFPS: stats.currentFrame ? 1000 / stats.currentFrame : 0, averageFPS: stats.elapsed ? stats.frames * 1000 / stats.elapsed : 0,
            minFPS: stats.maxFrame ? 1000 / stats.maxFrame : 0, averageFrameMs: stats.frames ? stats.elapsed / stats.frames : 0,
            activeURLs: urls.size, pendingRAF: Object.fromEntries([...new Set(pending.values())].map(name => [name, [...pending.values()].filter(value => value === name).length])),
            audio: !audio?.getAttribute('src') ? 'empty' : audio.ended ? 'ended' : audio.paused ? 'paused' : 'playing', timingOpen: !!document.querySelector('#future-timing')?.open,
            layout: window.VisualizerRuntime?.getStandalone().visualizer.layout, stage: rect ? { width: rect.width, height: rect.height, canonical: '1920x1080' } : null,
            heapBytes: performance.memory?.usedJSHeapSize ?? null, dpr: devicePixelRatio, userAgent: navigator.userAgent, visibility: document.visibilityState,
            gpuStatus: 'UNKNOWN — inspect chrome://gpu on the hardware under test', duplicateListenerAttempts, audioGraphs, detail, currentLoop };
    }
    try {
        observer = new PerformanceObserver(list => { for (const task of list.getEntries()) { stats.longTasks++; stats.longTaskMs += task.duration; } });
        observer.observe({ type: 'longtask' });
    } catch { /* Optional browser metric. */ }
    window.WaveCanvasPerf = Object.freeze({ reset, snapshot, wrap, record, wrapExports, listeners });
    document.addEventListener('DOMContentLoaded', () => {
        overlay = document.createElement('pre'); overlay.id = 'performance-overlay'; overlay.setAttribute('aria-label', '開發效能量測');
        overlay.style.cssText = 'position:fixed;top:8px;right:8px;z-index:9999;background:#101620e8;color:#c6edcd;padding:10px;font:11px/1.5 monospace;pointer-events:none;margin:0;max-width:300px';
        document.body.append(overlay);
        interval = setInterval(() => {
            const s = snapshot(); overlay.textContent = 'DEV profiling · JS / RAF cadence\nFPS current / avg / min: ' + [s.currentFPS,s.averageFPS,s.minFPS].map(x => x.toFixed(1)).join(' / ') + '\nFrame avg: ' + s.averageFrameMs.toFixed(2) + ' ms · long: ' + s.longFrames + '\nAudio: ' + s.audio + ' · Timing: ' + s.timingOpen + '\nLayout: ' + s.layout + ' · Stage: ' + (s.stage ? s.stage.width.toFixed(0) + '×' + s.stage.height.toFixed(0) : '—') + '\nURLs: ' + s.activeURLs + ' · heap: ' + (s.heapBytes === null ? 'n/a' : (s.heapBytes / 1048576).toFixed(1) + ' MB');
        }, 500);
    }, { once: true });
    window.addEventListener('pagehide', event => { if (!event.persisted) { clearInterval(interval); observer?.disconnect(); } });
}());

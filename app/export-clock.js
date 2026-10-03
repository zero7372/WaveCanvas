(function () {
    'use strict';
    let time = 0, serial = 0, seed = 0x57415645;
    const callbacks = new Map(), animations = new Map();
    const timers = new Map();
    const nativeAnimate = Element.prototype.animate;
    const nativeRAF = window.requestAnimationFrame.bind(window);
    Object.defineProperty(document, 'hidden', { get: () => false });
    window.requestAnimationFrame = callback => { callbacks.set(++serial, callback); return serial; };
    window.cancelAnimationFrame = id => callbacks.delete(id);
    window.setInterval = (callback, period) => { const id = ++serial; timers.set(id, { callback, period: Math.max(1, period), next: time + Math.max(1, period) }); return id; };
    window.clearInterval = id => timers.delete(id);
    Object.defineProperty(performance, 'now', { value: () => time });
    Date.now = () => 946684800000 + time;
    Math.random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
    Element.prototype.animate = function (...args) {
        const animation = nativeAnimate.apply(this, args);
        animation.pause(); animation.currentTime = 0; animations.set(animation, time); return animation;
    };
    const audio = document.querySelector('#local-audio');
    let duration = 0;
    for (const [key, getter] of Object.entries({ currentTime: () => time / 1000, duration: () => duration,
        paused: () => false, ended: () => time / 1000 >= duration, seeking: () => false, readyState: () => 4 })) {
        Object.defineProperty(audio, key, { get: getter });
    }
    window.WaveCanvasExportClock = Object.freeze({
        configure(seconds) { duration = seconds; },
        paintBarrier(count = 2) {
            return new Promise(resolve => {
                const next = () => count-- > 0 ? nativeRAF(next) : resolve();
                next();
            });
        },
        async settle() {
            await Promise.all([...animations.keys()].map(animation => animation.ready.catch(() => {})));
            for (const [animation, start] of animations) if (animation.playState !== 'idle') animation.currentTime = Math.max(0, time - start);
        },
        advance(seconds) {
            time = seconds * 1000;
            for (const timer of timers.values()) while (time >= timer.next) { timer.callback(); timer.next += timer.period; }
            const batch = [...callbacks.values()]; callbacks.clear();
            for (const callback of batch) callback(time);
            for (const [animation, start] of animations) {
                if (animation.playState === 'idle') { animations.delete(animation); continue; }
                animation.currentTime = Math.max(0, time - start);
            }
        }
    });
}());

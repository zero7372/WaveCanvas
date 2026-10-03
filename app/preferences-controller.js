(function () {
    'use strict';
    const schema = window.WaveCanvasAppSettings, api = window.waveCanvas?.settings, listeners = new Set();
    let value = schema.normalize(null);
    function apply(next) { value = schema.normalize(next); for (const callback of listeners) callback(get()); return get(); }
    function get() { return schema.normalize(value); }
    const ready = api ? api.get().then(apply).catch(error => { console.warn('Preferences:', error.message); return get(); }) : Promise.resolve(get());
    const unsubscribe = api?.onChanged(apply);
    window.addEventListener('pagehide', () => unsubscribe?.(), { once: true });
    window.WaveCanvasPreferences = Object.freeze({ get, ready, available: Boolean(api),
        async update(changes) { if (!api) throw Error('Preferences 需使用 Desktop App。'); return apply(await api.update(changes)); },
        async reset() { if (!api) throw Error('Preferences 需使用 Desktop App。'); return apply(await api.reset()); },
        subscribe(callback) { listeners.add(callback); callback(get()); return () => listeners.delete(callback); }
    });
}());

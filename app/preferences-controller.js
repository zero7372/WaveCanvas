(function () {
    'use strict';
    const schema = window.WaveCanvasAppSettings, api = window.waveCanvas?.settings, listeners = new Set();
    let value = schema.normalize(null);
    // 沒有 Desktop App 偏好設定時也先依系統語言顯示。
    function language() { window.WaveCanvasI18n.setLanguage(window.WaveCanvasI18n.resolve(value.interface.language, navigator.languages)); }
    language();
    function apply(next) { value = schema.normalize(next); language(); document.documentElement.style.setProperty('--ui-scale', String(value.interface.uiScale)); for (const callback of listeners) callback(get()); window.dispatchEvent(new Event('wavecanvas-recent-change')); window.dispatchEvent(new Event('resize')); return get(); }
    function get() { return schema.normalize(value); }
    const ready = api ? api.get().then(apply).catch(error => { console.warn('Preferences:', error.message); return get(); }) : Promise.resolve(get());
    const unsubscribe = api?.onChanged(apply);
    window.addEventListener('pagehide', () => unsubscribe?.(), { once: true });
    window.WaveCanvasPreferences = Object.freeze({ get, ready, available: Boolean(api),
        async update(changes, restoringDefaults = false) { if (!api) throw Error(window.WaveCanvasI18n.t('Preferences 需使用 Desktop App。')); return apply(await api.update(changes, restoringDefaults)); },
        async reset() { if (!api) throw Error(window.WaveCanvasI18n.t('Preferences 需使用 Desktop App。')); return apply(await api.reset()); },
        subscribe(callback) { listeners.add(callback); callback(get()); return () => listeners.delete(callback); }
    });
}());

(function (root, factory) {
    const schema = factory();
    if (typeof module === 'object' && module.exports) module.exports = schema;
    else root.WaveCanvasAppSettings = schema;
}(typeof window === 'object' ? window : globalThis, function () {
    'use strict';
    const intervals = Object.freeze([1, 3, 5, 10, 15]), recentLimits = Object.freeze([5, 10, 15, 20]), scales = Object.freeze([0.8, 0.9, 1, 1.1, 1.25]);
    // system = 跟隨系統語言；沒有對應語言時由 i18n 退回 English。
    const languages = Object.freeze(['system', 'zh-TW', 'en', 'ja']);
    // 錯誤訊息走介面語言；在 Main 與 Renderer 都可用，測試環境沒有 i18n 時保留原文。
    const t = (source, params) => {
        const api = typeof module === 'object' && module.exports ? require('./i18n.js') : globalThis.WaveCanvasI18n;
        return api ? api.t(source, params) : source.replace(/\{(\w+)\}/g, (match, name) => params?.[name] ?? match);
    };
    const defaults = Object.freeze({ format: 'wavecanvas-settings', version: 1,
        general: Object.freeze({ startupMode: 'home', rememberWindowBounds: true, confirmUnsavedClose: true }),
        project: Object.freeze({ askNameOnCreate: true, autosaveEnabled: true, autosaveIntervalMinutes: 5, recentProjectsLimit: 10 }),
        playback: Object.freeze({ defaultVolume: 1, autoPlayOnLoad: false }),
        interface: Object.freeze({ uiScale: 1, language: 'system' }),
        export: Object.freeze({ defaultDirectoryMode: 'last-used', customDirectory: null }) });
    const validators = {
        startupMode: v => ['home', 'reopen-last'].includes(v),
        autosaveIntervalMinutes: v => intervals.includes(v), recentProjectsLimit: v => recentLimits.includes(v), uiScale: v => scales.includes(v), language: v => languages.includes(v),
        defaultVolume: v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1,
        defaultDirectoryMode: v => ['last-used', 'project-folder', 'custom'].includes(v),
        customDirectory: v => v === null || typeof v === 'string' && v.length > 0 && v.length <= 32767 && !/[\x00-\x1f]/.test(v) && /^(?:[a-z]:[\\/]|\\\\[^\\]+\\[^\\]+)/i.test(v)
    };
    function valid(key, value) { return validators[key] ? validators[key](value) : typeof value === 'boolean'; }
    function normalize(value) {
        const source = value?.format === defaults.format && value.version === defaults.version ? value : {};
        const result = { format: defaults.format, version: defaults.version };
        for (const group of ['general', 'project', 'playback', 'interface', 'export']) {
            result[group] = {};
            for (const [key, fallback] of Object.entries(defaults[group])) result[group][key] = valid(key, source[group]?.[key]) ? source[group][key] : fallback;
        }
        return result;
    }
    function patch(value, changes) {
        if (!changes || typeof changes !== 'object' || Array.isArray(changes) || !Object.keys(changes).length) throw Error(t('Preferences 更新無效。'));
        const result = normalize(value);
        for (const [group, fields] of Object.entries(changes)) {
            if (!Object.hasOwn(result, group) || ['format', 'version'].includes(group) || !fields || typeof fields !== 'object' || Array.isArray(fields)) throw Error(t('Preferences 分類無效。'));
            for (const [key, entry] of Object.entries(fields)) {
                if (!Object.hasOwn(defaults[group], key) || !valid(key, entry)) throw Error(t('Preferences 欄位無效：{key}', { key }));
                result[group][key] = entry;
            }
        }
        return result;
    }
    return Object.freeze({ defaults, intervals, recentLimits, scales, languages, normalize, patch });
}));

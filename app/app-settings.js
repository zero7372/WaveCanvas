(function (root, factory) {
    const schema = factory();
    if (typeof module === 'object' && module.exports) module.exports = schema;
    else root.WaveCanvasAppSettings = schema;
}(typeof window === 'object' ? window : globalThis, function () {
    'use strict';
    const intervals = Object.freeze([1, 3, 5, 10, 15]);
    const defaults = Object.freeze({ format: 'wavecanvas-settings', version: 1, project: Object.freeze({
        askNameOnCreate: true, autosaveEnabled: true, autosaveIntervalMinutes: 5
    }) });
    function normalize(value) {
        const source = value?.format === defaults.format && value.version === defaults.version ? value.project : null;
        return { format: defaults.format, version: defaults.version, project: {
            askNameOnCreate: typeof source?.askNameOnCreate === 'boolean' ? source.askNameOnCreate : defaults.project.askNameOnCreate,
            autosaveEnabled: typeof source?.autosaveEnabled === 'boolean' ? source.autosaveEnabled : defaults.project.autosaveEnabled,
            autosaveIntervalMinutes: intervals.includes(source?.autosaveIntervalMinutes) ? source.autosaveIntervalMinutes : defaults.project.autosaveIntervalMinutes
        } };
    }
    function patch(value, changes) {
        if (!changes || typeof changes !== 'object' || Array.isArray(changes) || Object.keys(changes).some(k => k !== 'project') ||
            !changes.project || typeof changes.project !== 'object' || Array.isArray(changes.project)) throw Error('Preferences 更新無效。');
        for (const [key, entry] of Object.entries(changes.project)) {
            if (!Object.hasOwn(defaults.project, key) || (key === 'autosaveIntervalMinutes' ? !intervals.includes(entry) : typeof entry !== 'boolean')) throw Error('Preferences 欄位無效：' + key);
        }
        return normalize({ ...defaults, project: { ...normalize(value).project, ...changes.project } });
    }
    return Object.freeze({ defaults, intervals, normalize, patch });
}));

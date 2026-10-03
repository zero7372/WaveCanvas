(function () {
    'use strict';
    const runtime = window.VisualizerRuntime;
    const schema = runtime.getSchema().properties;
    const format = 'audio-visualizer-preset';
    function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }

    function create(name) {
        const properties = runtime.getSettings();
        for (const [key, property] of Object.entries(schema)) {
            if (!window.VisualizerPropertyCompatibility.visible(key)) { delete properties[key]; continue; }
            if (property.type === 'file' || property.type === 'directory') properties[key] = runtime.getDefaults()[key];
        }
        return { format, version: 1, name: String(name || 'Untitled').slice(0, 200), properties, standalone: runtime.getStandalone() };
    }

    function parse(text) {
        if (typeof text !== 'string' || text.length > 1024 * 1024) throw new Error('Preset 必須是小於 1 MB 的 JSON。');
        let preset;
        try { preset = JSON.parse(text); } catch { throw new Error('Preset JSON 格式損壞。'); }
        if (!object(preset) || preset.format !== format || preset.version !== 1 || !object(preset.properties)) {
            throw new Error('不支援的 Preset 格式或版本。');
        }
        if (preset.standalone !== undefined && !object(preset.standalone)) throw new Error('standalone 格式無效。');
        const layout = preset.standalone?.visualizer?.layout ?? 'circle';
        const baseline = runtime.getStandaloneDefaults(layout);
        const properties = runtime.getDefaults(layout);
        const warnings = [];
        for (const [key, entry] of Object.entries(preset.properties)) {
            const definition = Object.prototype.hasOwnProperty.call(schema, key) ? schema[key] : null;
            if (window.VisualizerPropertyCompatibility.retired(key)) { warnings.push('Ignored retired: ' + key); continue; }
            if (!definition || definition.type === 'text') { warnings.push('Ignored: ' + key); continue; }
            if (definition.type === 'file' || definition.type === 'directory') continue; // Never restore URLs or filesystem paths from presets.
            const rawValue = object(entry) && Object.prototype.hasOwnProperty.call(entry, 'value') ? entry.value : entry;
            const value = window.VisualizerPropertyCompatibility.value(key, rawValue);
            if (value !== rawValue) warnings.push('Migrated: ' + key);
            switch (definition.type) {
                case 'slider':
                    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(key + ' 必須是有限數值。');
                    properties[key] = { value: Math.round(Math.min(definition.max, Math.max(definition.min, value))) };
                    break;
                case 'combo':
                    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(key + ' 必須是有限數值。');
                    if (definition.options.some(option => option.value === value)) properties[key] = { value };
                    else warnings.push('Defaulted: ' + key);
                    break;
                case 'bool':
                    if (typeof value !== 'boolean') throw new Error(key + ' 必須是布林值。');
                    properties[key] = { value };
                    break;
                case 'color': {
                    if (typeof value !== 'string') throw new Error(key + ' 顏色格式無效。');
                    const components = value.trim().split(/\s+/);
                    if (components.length !== 3 || components.some(part => part === '' || !Number.isFinite(Number(part)))) throw new Error(key + ' 顏色格式無效。');
                    properties[key] = { value: components.map(part => Math.min(1, Math.max(0, Number(part)))).join(' ') };
                    break;
                }
            }
        }
        let inputGain = preset.standalone?.inputGain ?? baseline.inputGain;
        if (typeof inputGain !== 'number' || !Number.isFinite(inputGain)) throw new Error('Input Gain 必須是有限數值。');
        inputGain = Math.min(4, Math.max(0.25, inputGain));
        const visualizer = preset.standalone?.visualizer === undefined ? baseline.visualizer
            : window.VisualizerLayoutSettings.normalize(preset.standalone.visualizer, baseline.visualizer);
        const lyrics = preset.standalone?.lyrics === undefined ? baseline.lyrics
            : window.VisualizerLyricsSettings.normalize(preset.standalone.lyrics, baseline.lyrics);
        const background = preset.standalone?.background === undefined ? baseline.background
            : window.VisualizerBackgroundSettings.normalize(preset.standalone.background, baseline.background);
        const songInfo = preset.standalone?.text === undefined ? baseline.text
            : window.VisualizerSongInfoSettings.normalize(preset.standalone.text, baseline.text);
        return { name: typeof preset.name === 'string' ? preset.name.slice(0, 200) : 'Imported', properties, standalone: { inputGain, visualizer, lyrics, background, text: songInfo }, warnings };
    }

    function apply(parsed) {
        window.VisualizerFiles?.cancelPending();
        // Activate the destination bank before applying its values; do not contaminate the outgoing layout.
        runtime.updateStandalone({ visualizer: { layout: parsed.standalone.visualizer.layout } });
        runtime.updateProperties(parsed.properties);
        runtime.updateStandalone(parsed.standalone);
    }
    window.VisualizerPresets = Object.freeze({
        create, parse,
        import(text) { const parsed = parse(text); apply(parsed); return parsed; },
        reset() { apply({ properties: runtime.getDefaults(), standalone: runtime.getStandaloneDefaults() }); }
    });
}());

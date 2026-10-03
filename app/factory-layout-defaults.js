(function () {
    'use strict';
    const clone = value => JSON.parse(JSON.stringify(value));
    const schema = window.VisualizerPropertySchema.properties;
    const sources = window.VisualizerFactorySources;
    const policy = window.VisualizerInspectorPolicy;
    const propertyKeys = Object.keys(policy.propertySections).filter(key => !['particles', 'other'].includes(policy.propertySections[key]));
    const textKeys = ['positionX', 'positionY'];
    const defaults = {};
    function freeze(value) {
        if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
        return value;
    }
    for (const [layout, source] of Object.entries(sources)) {
        const preset = source.preset;
        const properties = Object.fromEntries(Object.entries(schema).filter(([, field]) => field.type !== 'text').map(([key, field]) => [key, { value: field.value ?? '' }]));
        for (const [key, entry] of Object.entries(preset.properties)) {
            if (Object.hasOwn(properties, key) && !window.VisualizerPropertyCompatibility.retired(key)) properties[key] = clone(entry);
        }
        defaults[layout] = {
            properties,
            standalone: {
                inputGain: preset.standalone.inputGain,
                visualizer: window.VisualizerLayoutSettings.normalize(preset.standalone.visualizer),
                lyrics: window.VisualizerLyricsSettings.normalize(preset.standalone.lyrics),
                background: window.VisualizerBackgroundSettings.normalize(preset.standalone.background),
                text: window.VisualizerSongInfoSettings.normalize(preset.standalone.text)
            }
        };
    }
    freeze(defaults);
    window.VisualizerFactoryDefaults = Object.freeze({
        layouts: Object.freeze(Object.keys(defaults)),
        propertyKeys: Object.freeze(propertyKeys), textKeys: Object.freeze(textKeys),
        get(layout = 'circle') {
            if (!Object.hasOwn(defaults, layout)) throw new RangeError('Unknown factory layout: ' + layout);
            return clone(defaults[layout]);
        },
        // Compare numbers without a dirty-state subsystem; never quantize the official value.
        equal: (current, baseline) => typeof current === 'number' && typeof baseline === 'number'
            ? Math.abs(current - baseline) <= 1e-7 * Math.max(1, Math.abs(baseline)) : current === baseline
    });
}());

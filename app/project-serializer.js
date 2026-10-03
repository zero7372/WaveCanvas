(function () {
    'use strict';
    const runtime = window.VisualizerRuntime, model = window.WaveCanvasProjectModel;
    function capture(metadata, media) {
        const settings = runtime.exportProjectSettings();
        // Files are references in media, never temporary renderer URLs in settings or layout banks.
        for (const [key, field] of Object.entries(runtime.getSchema().properties)) {
            if (!['file', 'directory'].includes(field.type)) continue;
            if (settings.properties[key]) settings.properties[key] = { value: '' };
            for (const bank of Object.values(settings.layouts)) if (bank.properties[key]) bank.properties[key] = { value: '' };
        }
        return model.validate({ ...metadata, format: 'wavecanvas-project', version: 1, state: { settings,
            media: Object.fromEntries(model.slots.map(slot => [slot, media[slot] || null])),
            lyrics: { primary: window.VisualizerLyrics.getDocument('primary'), secondary: window.VisualizerLyrics.getDocument('secondary') } } });
    }
    function prepare(project) {
        const value = model.validate(project);
        value.state.settings = runtime.validateProjectSettings(value.state.settings);
        // Untrusted project settings cannot load arbitrary URLs; only Main-authorized media slots can.
        for (const [key, field] of Object.entries(runtime.getSchema().properties)) if (['file', 'directory'].includes(field.type)) {
            value.state.settings.properties[key] = { value: '' };
            for (const bank of Object.values(value.state.settings.layouts)) if (bank.properties[key]) bank.properties[key] = { value: '' };
        }
        return value;
    }
    window.WaveCanvasProjectSerializer = Object.freeze({ capture, prepare });
}());

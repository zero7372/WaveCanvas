(function () {
    'use strict';

    const schema = window.VisualizerPropertySchema;
    const compatibility = window.VisualizerPropertyCompatibility;
    const runtimeKeys = Object.keys(schema.properties).filter(key => schema.properties[key].type !== 'text');
    const settings = Object.create(null);
    const legacyUpdates = Object.create(null);
    const hasWEAudio = typeof window.wallpaperRegisterAudioListener === 'function';
    const factory = window.VisualizerFactoryDefaults;
    let propertySink = null;
    let audioSink = null;
    const subscribers = new Set();
    const standalone = getStandaloneDefaults('circle');
    const layoutStates = new Map();
    const gainedAudio = new Array(128).fill(0);

    for (const key of runtimeKeys) {
        const property = schema.properties[key];
        settings[key] = { value: Object.prototype.hasOwnProperty.call(property, 'value') ? property.value : '' };
    }
    if (!hasWEAudio) Object.assign(settings, factory.get('circle').properties);

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function getDefaults(layout = standalone.visualizer.layout) {
        if (!hasWEAudio) return factory.get(layout).properties;
        return Object.fromEntries(runtimeKeys.map(key => [key, { value: schema.properties[key].value ?? '' }]));
    }

    function getStandaloneDefaults(layout = 'circle') {
        if (!hasWEAudio) return factory.get(layout).standalone;
        return { inputGain: 1, visualizer: window.VisualizerLayoutSettings.defaults(), lyrics: window.VisualizerLyricsSettings.defaults(), background: window.VisualizerBackgroundSettings.defaults(), text: window.VisualizerSongInfoSettings.defaults() };
    }

    function rememberLayout() {
        layoutStates.set(standalone.visualizer.layout, {
            visualizer: clone(standalone.visualizer),
            properties: Object.fromEntries(factory.propertyKeys.map(key => [key, clone(settings[key])])),
            text: Object.fromEntries(factory.textKeys.map(key => [key, standalone.text[key]]))
        });
    }

    function layoutState(layout) {
        if (layoutStates.has(layout)) return clone(layoutStates.get(layout));
        const baseline = factory.get(layout);
        return {
            visualizer: baseline.standalone.visualizer,
            properties: Object.fromEntries(factory.propertyKeys.map(key => [key, baseline.properties[key]])),
            text: Object.fromEntries(factory.textKeys.map(key => [key, baseline.standalone.text[key]]))
        };
    }

    function notify() {
        for (const listener of subscribers) listener(clone(settings), clone(standalone));
    }

    function subscribe(listener) {
        subscribers.add(listener);
        listener(clone(settings), clone(standalone));
        return () => subscribers.delete(listener);
    }

    function updateStandalone(patch) {
        if (hasWEAudio) return clone(standalone);
        // Validate before saving/switching a bank: rejected patches never change any layout state.
        const requested = patch.visualizer?.layout ?? standalone.visualizer.layout;
        const switching = requested !== standalone.visualizer.layout;
        const incoming = switching ? layoutState(requested) : null;
        const visualizer = patch.visualizer === undefined ? standalone.visualizer
            : window.VisualizerLayoutSettings.normalize(patch.visualizer, incoming?.visualizer || standalone.visualizer);
        const lyrics = patch.lyrics === undefined ? standalone.lyrics
            : window.VisualizerLyricsSettings.normalize(patch.lyrics, standalone.lyrics);
        const background = patch.background === undefined ? standalone.background
            : window.VisualizerBackgroundSettings.normalize(patch.background, standalone.background);
        const textBase = incoming ? { ...standalone.text, ...incoming.text } : standalone.text;
        const text = patch.text === undefined ? textBase
            : window.VisualizerSongInfoSettings.normalize(patch.text, textBase);
        if (Object.prototype.hasOwnProperty.call(patch, 'inputGain')) {
            if (typeof patch.inputGain !== 'number' || !Number.isFinite(patch.inputGain)) throw new TypeError('Input Gain must be finite');
            standalone.inputGain = Math.min(4, Math.max(0.25, patch.inputGain));
        }
        if (switching) {
            rememberLayout();
            Object.assign(settings, incoming.properties);
            if (propertySink) propertySink(clone(incoming.properties));
        }
        standalone.visualizer = visualizer;
        standalone.lyrics = lyrics;
        standalone.background = background;
        standalone.text = text;
        settings.bassshaketext = { value: text.bassReaction };
        settings.txtbassmultiplier = { value: text.bassStrength };
        notify();
        return clone(standalone);
    }

    function normalizeValue(key, value) {
        const property = schema.properties[key];
        switch (property.type) {
            case 'bool':
                if (typeof value !== 'boolean') throw new TypeError(key + ' must be boolean');
                break;
            case 'slider':
            case 'combo':
                if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(key + ' must be finite');
                if (property.type === 'combo' && !property.options.some(option => option.value === value)) {
                    throw new RangeError(key + ' has no such option');
                }
                if (property.type === 'slider' && (value < property.min || value > property.max)) {
                    throw new RangeError(key + ' is outside the schema range');
                }
                break;
            case 'color':
                if (typeof value !== 'string' || value.trim().split(/\s+/).length !== 3
                    || !value.trim().split(/\s+/).every(part => part !== '' && Number.isFinite(Number(part)) && Number(part) >= 0 && Number(part) <= 1)) {
                    throw new TypeError(key + ' must contain three RGB values between 0 and 1');
                }
                value = value.trim().split(/\s+/).join(' ');
                break;
            case 'file':
            case 'directory':
                if (typeof value !== 'string') throw new TypeError(key + ' must be a path or URL string');
                break;
        }
        return value;
    }

    function updateProperties(updates) {
        const patch = Object.create(null);
        for (const [key, entry] of Object.entries(updates || {})) {
            // Keep the old code-only key as passthrough; do not add it to the schema or reinterpret it.
            if (hasWEAudio && key === 'rainbow' && entry && typeof entry.value === 'boolean') {
                patch[key] = { value: entry.value };
                continue;
            }
            if (compatibility.retired(key) || !Object.prototype.hasOwnProperty.call(settings, key)) continue;
            const value = compatibility.value(key, normalizeValue(key, compatibility.value(key, entry && entry.value)));
            patch[key] = { value };
        }
        for (const [key, entry] of Object.entries(patch)) {
            if (key === 'rainbow') legacyUpdates[key] = entry;
            else settings[key] = entry;
        }
        if (!hasWEAudio) {
            if (patch.bassshaketext) standalone.text.bassReaction = patch.bassshaketext.value;
            if (patch.txtbassmultiplier) standalone.text.bassStrength = patch.txtbassmultiplier.value;
        }
        if (propertySink && Object.keys(patch).length) propertySink(patch);
        notify();
        return clone(settings);
    }

    const previousListener = window.wallpaperPropertyListener || {};
    window.wallpaperPropertyListener = Object.assign({}, previousListener, {
        applyUserProperties(properties) {
            try {
                updateProperties(properties);
            } catch (error) {
                console.error('Wallpaper property update rejected:', error);
            }
        }
    });

    function attachProperties(sink) {
        if (propertySink) throw new Error('Visualizer properties already attached');
        propertySink = sink;
        // One complete snapshot merges defaults with any WE updates received before initialization.
        propertySink(Object.assign(clone(settings), clone(legacyUpdates)));
    }

    function attachAudio(sink) {
        if (audioSink) throw new Error('Visualizer audio already attached');
        audioSink = sink;
        audioSink(new Array(128).fill(0));
        if (hasWEAudio) window.wallpaperRegisterAudioListener(sink);
    }

    function deliverLocalAudio(samples) {
        if (!hasWEAudio && audioSink) {
            for (let i = 0; i < gainedAudio.length; i++) gainedAudio[i] = samples[i] * standalone.inputGain;
            audioSink(gainedAudio);
        }
    }

    function resolveFileURL(value) {
        if (!value) return null;
        if (/^(?:blob:|data:|https?:|file:)/i.test(value)) return value;
        return 'file:///' + value.replace(/\\/g, '/');
    }

    function restoreDefault(scope, key) {
        if (hasWEAudio) return;
        if (scope === 'properties') {
            if (schema.properties[key]?.type !== 'slider' || compatibility.retired(key)) throw new TypeError('Not a numeric runtime property');
            updateProperties({ [key]: getDefaults()[key] });
        } else {
            const baseline = getStandaloneDefaults(standalone.visualizer.layout);
            const value = scope === 'inputGain' ? baseline.inputGain : baseline[scope]?.[key];
            if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Not a numeric standalone setting');
            updateStandalone(scope === 'inputGain' ? { inputGain: value } : { [scope]: { [key]: value } });
        }
    }

    window.VisualizerRuntime = Object.freeze({
        mode: hasWEAudio ? 'wallpaper-engine' : 'standalone',
        getSchema: () => clone(schema),
        getSettings: () => clone(settings),
        getDefaults,
        getStandalone: () => clone(standalone),
        exportProjectSettings() {
            rememberLayout();
            return { properties: clone(settings), standalone: clone(standalone), layouts: Object.fromEntries(factory.layouts.map(layout => [layout, layoutState(layout)])) };
        },
        validateProjectSettings(state) {
            const result = clone(state);
            result.properties = { ...getDefaults(result.standalone.visualizer.layout), ...result.properties };
            for (const [key, entry] of Object.entries(result.properties)) {
                if (Object.hasOwn(settings, key) && !compatibility.retired(key)) entry.value = normalizeValue(key, entry.value);
            }
            const normalize = (value, layout) => ({
                inputGain: Math.min(4, Math.max(.25, value.inputGain)),
                visualizer: window.VisualizerLayoutSettings.normalize(value.visualizer, getStandaloneDefaults(layout).visualizer),
                lyrics: window.VisualizerLyricsSettings.normalize(value.lyrics),
                background: window.VisualizerBackgroundSettings.normalize(value.background),
                text: window.VisualizerSongInfoSettings.normalize(value.text)
            });
            if (!Number.isFinite(result.standalone.inputGain)) throw new Error('Input Gain 無效。');
            result.standalone = normalize(result.standalone, result.standalone.visualizer.layout);
            for (const layout of factory.layouts) {
                const bank = result.layouts[layout];
                if (!bank || bank.visualizer.layout !== layout) throw new Error('Layout bank 無效：' + layout);
                bank.visualizer = window.VisualizerLayoutSettings.normalize(bank.visualizer, getStandaloneDefaults(layout).visualizer);
                bank.properties = Object.fromEntries(factory.propertyKeys.map(key => [key, { value: normalizeValue(key, bank.properties[key].value) }]));
                bank.text = Object.fromEntries(factory.textKeys.map(key => [key, window.VisualizerSongInfoSettings.normalize(bank.text)[key]]));
            }
            return result;
        },
        restoreProjectSettings(state) {
            const value = this.validateProjectSettings(state);
            layoutStates.clear();
            for (const layout of factory.layouts) layoutStates.set(layout, clone(value.layouts[layout]));
            updateStandalone({ visualizer: { layout: value.standalone.visualizer.layout } });
            updateProperties(value.properties);
            updateStandalone(value.standalone);
            for (const layout of factory.layouts) layoutStates.set(layout, clone(value.layouts[layout]));
        },
        getStandaloneDefaults: (layout = standalone.visualizer.layout) => getStandaloneDefaults(layout),
        updateStandalone,
        restoreDefault,
        subscribe,
        updateProperties,
        attachProperties,
        attachAudio,
        deliverLocalAudio,
        resolveFileURL
    });
}());

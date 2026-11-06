(function () {
    'use strict';
    const clone = value => JSON.parse(JSON.stringify(value));
    const schema = window.VisualizerPropertySchema.properties;
    const sources = window.VisualizerFactorySources;
    const policy = window.VisualizerInspectorPolicy;
    // 只有會隨排列改變的形狀與位置各存一份；顏色、低頻反應與旋轉在排列之間共用。
    const propertyKeys = Object.freeze(['circleradius', 'circlearc', 'circlerotate', 'barwidth', 'barheight', 'barsarc', 'audiocount', 'userspectrumrotation', 'reverseright',
        'barsrotate', 'barcircledistance', 'secondcircle', 'secondcircleradius', 'eqpositionx', 'eqpositiony']);
    const textKeys = ['positionX', 'positionY'];
    // 原廠快照不可變動，但快照裡的歌曲資訊與歌詞（75%）會疊在一起，所以在這裡覆寫。
    // 7% 的文字下緣約在畫布 y=128，高於圓形頻譜滿振幅時的頂端（y=134）。
    const songInfoPositionY = 7;
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
                text: window.VisualizerSongInfoSettings.normalize({ ...preset.standalone.text, positionY: songInfoPositionY })
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

(function () {
    'use strict';
    const definitions = Object.freeze([
        { id: 'circle-default', name: 'Circle', subtitle: '環形頻譜', description: '以封面為中心的環形音訊頻譜，適合主視覺置中的構圖。', thumbnail: 'assets/templates/builtin_circle_default.png', previewVideo: null, layout: 'circle' },
        { id: 'square-default', name: 'Square', subtitle: '方形頻譜', description: '圍繞封面的方形頻譜框架，適合對稱、穩定的視覺配置。', thumbnail: 'assets/templates/builtin_square_default.png', previewVideo: null, layout: 'square' },
        { id: 'linear-default', name: 'Linear', subtitle: '直線頻譜', description: '橫向或直向的直線頻譜，搭配可獨立配置的封面位置與樣式。', thumbnail: 'assets/templates/builtin_linear_default.png', previewVideo: null, layout: 'linear' }
    ].map(Object.freeze));
    function apply(id) {
        const runtime = window.VisualizerRuntime;
        if (runtime.mode !== 'standalone') return;
        const definition = definitions.find(template => template.id === id);
        if (!definition) throw new RangeError('未知的內建模板。');
        const baseline = window.VisualizerFactoryDefaults.get(definition.layout);
        // Appearance only: media URLs, audio settings and Lyrics state never enter this patch.
        const keys = new Set(window.VisualizerFactoryDefaults.propertyKeys);
        const policy = window.VisualizerInspectorPolicy;
        for (const [key, section] of Object.entries(policy.propertySections)) if (section === 'particles') keys.add(key);
        for (const key of ['backgroundcolor', 'imageoptions1', 'horizontal', 'vertical']) keys.add(key);
        const properties = Object.fromEntries([...keys].map(key => [key, baseline.properties[key]]));
        const { title, artist, ...textAppearance } = baseline.standalone.text;
        runtime.updateStandalone({ visualizer: { layout: definition.layout } });
        runtime.updateProperties(properties);
        runtime.updateStandalone({ visualizer: baseline.standalone.visualizer, background: baseline.standalone.background, text: textAppearance });
        return definition;
    }
    window.VisualizerTemplates = Object.freeze({ definitions, apply });
}());

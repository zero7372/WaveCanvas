(function () {
    'use strict';
    const families = ['system-ui', 'Arial', 'Segoe UI', 'Microsoft JhengHei', 'Noto Sans', 'Georgia', 'Times New Roman', 'Courier New', 'monospace', 'sans-serif', 'serif'];
    const fallback = '"Microsoft JhengHei", "PingFang TC", "Noto Sans CJK TC", "Noto Sans JP", system-ui, sans-serif';
    function normalize(family) { return families.includes(family) ? family : 'system-ui'; }
    function fontStack(family) {
        family = normalize(family);
        if (['serif', 'sans-serif', 'monospace', 'system-ui'].includes(family)) return family + ', ' + fallback;
        const generic = ['Georgia', 'Times New Roman'].includes(family) ? 'serif' : family === 'Courier New' ? 'monospace' : 'sans-serif';
        return '"' + family + '", ' + fallback.replace(/, sans-serif$/, ', ' + generic);
    }
    window.VisualizerSystemFonts = Object.freeze({ families: Object.freeze(families), fallback, normalize, fontStack,
        options: Object.freeze(families.map(value => Object.freeze({ value, label: value === 'system-ui' ? '系統字型' : value })))
    });
}());

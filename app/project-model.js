(function (root, factory) {
    'use strict';
    const model = factory();
    if (typeof module === 'object' && module.exports) module.exports = model;
    else root.WaveCanvasProjectModel = model;
}(typeof window === 'object' ? window : globalThis, function () {
    'use strict';
    const slots = ['audio', 'cover', 'background', 'primary', 'secondary'];
    function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
    function stable(value) {
        if (Array.isArray(value)) return value.map(stable);
        if (object(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
        return value;
    }
    function safe(value, depth = 0) {
        if (depth > 30) throw new Error('專案資料層數過深。');
        if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('專案包含無效數值。');
        if (typeof value === 'string' && value.length > 2 * 1024 * 1024) throw new Error('專案文字過長。');
        if (Array.isArray(value) && value.length > 20000) throw new Error('專案資料筆數過多。');
        if (object(value) || Array.isArray(value)) for (const [key, entry] of Object.entries(value)) {
            if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('專案包含不安全欄位。');
            safe(entry, depth + 1);
        }
    }
    function document(value, source) {
        if (value === null) return;
        if (!object(value) || value.source !== source || !['lrc', 'srt'].includes(value.sourceFormat) || typeof value.id !== 'string'
            || typeof value.name !== 'string' || !Number.isFinite(value.fileOffsetMs) || !Array.isArray(value.metadata)
            || value.metadata.some(line => typeof line !== 'string') || !Array.isArray(value.events)) throw new Error('歌詞文件格式無效。');
        const ids = new Set();
        for (const event of value.events) {
            if (!object(event) || typeof event.id !== 'string' || ids.has(event.id) || event.source !== source
                || !Number.isFinite(event.timeMs) || event.timeMs < 0 || event.timeMs > 599999999
                || !Array.isArray(event.lines) || event.lines.some(line => typeof line !== 'string')
                || typeof event.rawText !== 'string' || !['lyric', 'interlude'].includes(event.type)) throw new Error('歌詞事件格式無效。');
            ids.add(event.id);
            if (event.sourceCue && (!object(event.sourceCue) || !Array.isArray(event.sourceCue.rawLines)
                || event.sourceCue.rawLines.some(line => typeof line !== 'string'))) throw new Error('SRT sourceCue 無效。');
        }
        if (value.sourceWarnings && !Array.isArray(value.sourceWarnings)) throw new Error('歌詞 warnings 無效。');
    }
    function validate(project) {
        safe(project);
        if (!object(project) || project.format !== 'wavecanvas-project') throw new Error('不是 WaveCanvas 專案。');
        if (project.version > 1) throw new Error('專案版本較新，無法由目前 WaveCanvas 開啟。');
        if (project.version !== 1) throw new Error('不支援的專案版本。');
        if (typeof project.projectId !== 'string' || !/^[a-f0-9-]{36}$/i.test(project.projectId)) throw new Error('projectId 無效。');
        if (typeof project.name !== 'string' || !project.name.trim() || project.name.length > 200) throw new Error('專案名稱無效。');
        if (!object(project.state) || !object(project.state.settings) || !object(project.state.media) || !object(project.state.lyrics)) throw new Error('專案 state 無效。');
        const settings = project.state.settings;
        if (!object(settings.properties) || !object(settings.standalone) || !object(settings.layouts)
            || !['circle', 'square', 'linear'].includes(settings.standalone.visualizer?.layout)) throw new Error('專案 settings 無效。');
        for (const slot of slots) {
            const ref = project.state.media[slot];
            if (ref !== null && (typeof ref !== 'string' || !ref || ref.length > 32768 || /^(?:blob:|data:|https?:|file:)/i.test(ref))) throw new Error('媒體路徑無效：' + slot);
        }
        document(project.state.lyrics.primary, 'primary'); document(project.state.lyrics.secondary, 'secondary');
        return JSON.parse(JSON.stringify(project));
    }
    function parse(text) {
        if (typeof text !== 'string' || text.length > 16 * 1024 * 1024) throw new Error('專案必須是小於 16 MB 的 JSON。');
        let value; try { value = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { throw new Error('專案 JSON 格式損壞。'); }
        return validate(value);
    }
    // Identity / timestamps / name are metadata, not mutable working state.
    function comparison(project) { return JSON.stringify(stable(project.state)); }
    function serialize(project) { return JSON.stringify(stable(validate(project)), null, 2) + '\n'; }
    return Object.freeze({ slots, validate, parse, comparison, serialize, document });
}));

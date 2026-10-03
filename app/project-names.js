(function (root, factory) {
    const names = factory(); if (typeof module === 'object' && module.exports) module.exports = names;
    else root.WaveCanvasProjectNames = names;
}(typeof window === 'object' ? window : globalThis, function () {
    'use strict';
    const maxLength = 128;
    function normalize(value) {
        if (typeof value !== 'string' || !value.trim() || [...value.trim()].length > maxLength || /[\x00-\x1f\x7f]/.test(value)) throw Error('請輸入 1–128 字的專案名稱。');
        return value.trim();
    }
    function sanitizeProjectFilename(value) {
        let name = typeof value === 'string' ? value.trim().replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, '').replace(/[. ]+$/g, '') : '';
        while (name.length > maxLength) name = [...name].slice(0, -1).join('');
        name = name.replace(/[. ]+$/g, '');
        if (!name) name = 'WaveCanvas Project';
        if (/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(name)) name = '_' + name;
        return name;
    }
    return Object.freeze({ maxLength, normalize, sanitizeProjectFilename });
}));

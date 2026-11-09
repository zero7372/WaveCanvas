(function (root, factory) {
    const catalogs = typeof module === 'object' && module.exports
        ? { en: require('./locales/en.js'), ja: require('./locales/ja.js') }
        : root.WaveCanvasLocales || {};
    const api = factory(catalogs);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.WaveCanvasI18n = api;
}(typeof window === 'object' ? window : globalThis, function (catalogs) {
    'use strict';
    // 介面語言。原始碼中的繁體中文字串就是訊息 ID（gettext 式），翻譯集中在 app/locales/*.js。
    // 只翻譯介面文字；歌詞、曲名、專案名稱等使用者內容從不經過這裡。
    const languages = Object.freeze(['zh-TW', 'en', 'ja']);
    const htmlLang = Object.freeze({ 'zh-TW': 'zh-Hant', en: 'en', ja: 'ja' });
    const listeners = new Set(), missing = new Map();
    let language = 'zh-TW', reportMissing = false;
    // 系統語言清單依偏好順序比對；沒有對應語言時退回 English。
    function resolve(preference, systemLanguages = []) {
        if (languages.includes(preference)) return preference;
        for (const tag of systemLanguages) {
            const value = String(tag).toLowerCase();
            if (/^zh-(tw|hk|mo|hant)/.test(value)) return 'zh-TW';
            if (value === 'ja' || value.startsWith('ja-')) return 'ja';
            if (value === 'en' || value.startsWith('en-')) return 'en';
        }
        return 'en';
    }
    function lookup(source, target = language) {
        if (target === 'zh-TW') return source;
        const own = catalogs[target]?.messages;
        if (own && Object.hasOwn(own, source)) return own[source];
        note(source, target);
        const english = catalogs.en?.messages;
        if (target !== 'en' && english && Object.hasOwn(english, source)) return english[source];
        return source;
    }
    function note(source, target) {
        const key = target + '\u0000' + source;
        if (missing.has(key)) return;
        missing.set(key, { language: target, source });
        if (reportMissing) console.warn('[i18n] 缺少 ' + target + ' 翻譯：' + source);
    }
    function format(text, params) {
        if (!params) return text;
        // 參數可用 msg('原文') 包裝，表示它本身也是介面字串（例如欄位名稱），套用時一併翻譯。
        return text.replace(/\{(\w+)\}/g, (match, name) => {
            if (!Object.hasOwn(params, name)) return match;
            const value = params[name];
            return String(value !== null && typeof value === 'object' && Object.hasOwn(value, 'msg') ? lookup(value.msg) : value);
        });
    }
    function t(source, params) { return format(lookup(String(source)), params); }
    function setLanguage(next) {
        if (!languages.includes(next)) throw RangeError('Unsupported language: ' + next);
        if (next === language) return;
        language = next;
        for (const callback of listeners) callback(language);
    }
    return Object.freeze({
        languages, resolve, t, format, setLanguage, msg: source => ({ msg: String(source) }),
        language: () => language,
        htmlLang: (value = language) => htmlLang[value],
        // 只用來判斷某段文字是否為介面字串；英文目錄是唯一的完整清單。
        isMessage: source => Object.hasOwn(catalogs.en?.messages || {}, source),
        draft: value => Boolean(catalogs[value]?.draft),
        subscribe(callback) { listeners.add(callback); return () => listeners.delete(callback); },
        reportMissing(value) { reportMissing = Boolean(value); },
        missing: () => Array.from(missing.values())
    });
}));

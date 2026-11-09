(function () {
    'use strict';
    // 把介面上的繁中原文換成目前語言，並在切換語言時重新套用，不必重新建立介面。
    // 只比對「整段文字完全等於某個訊息 ID」的節點，所以使用者輸入的內容不會被改寫。
    const i18n = window.WaveCanvasI18n;
    const ATTRIBUTES = ['title', 'placeholder', 'aria-label', 'alt'];
    // 畫布內容（歌詞、曲名）與使用者可編輯區不翻譯；畫布語言固定，預覽才會與輸出一致。
    const SKIP = '#stage, [data-i18n-skip], textarea, [contenteditable], script, style';
    const texts = new WeakMap(), attributes = new WeakMap(), templates = new WeakMap(), attributeTemplates = new WeakMap();
    const tracked = new Set();
    function skipped(element) { return !element || element.closest(SKIP); }
    function translateText(node) {
        const parent = node.parentElement;
        if (skipped(parent) || templates.has(parent)) return;
        const value = node.nodeValue, record = texts.get(node);
        // 我們寫入的譯文不再當成新原文；程式改寫成別的文字時才重新判斷。
        const source = record && record.written === value ? record.source : value.trim();
        if (!source || !i18n.isMessage(source)) { if (record) texts.delete(node); return; }
        const translated = i18n.t(source), start = value.match(/^\s*/)[0], end = value.match(/\s*$/)[0];
        const written = source === value.trim() ? start + translated + end : record.lead + translated + record.trail;
        texts.set(node, { source, written, lead: source === value.trim() ? start : record.lead, trail: source === value.trim() ? end : record.trail });
        tracked.add(new WeakRef(node));
        if (value !== written) node.nodeValue = written;
    }
    function translateAttribute(element, name) {
        // 屬性只影響輔助說明與提示，不影響畫布，所以只排除明確標記的區域。
        if (element.closest?.('[data-i18n-skip]') || attributeTemplates.get(element)?.[name]) return;
        const value = element.getAttribute(name); if (value === null) return;
        let map = attributes.get(element); const record = map?.[name];
        const source = record && record.written === value ? record.source : value;
        if (!i18n.isMessage(source)) { if (record) delete map[name]; return; }
        const written = i18n.t(source);
        if (!map) { map = {}; attributes.set(element, map); }
        map[name] = { source, written }; tracked.add(new WeakRef(element));
        if (value !== written) element.setAttribute(name, written);
    }
    function translateTree(root) {
        if (root.nodeType === Node.TEXT_NODE) { translateText(root); return; }
        if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
        const element = root.nodeType === Node.DOCUMENT_NODE ? root.documentElement : root;
        if (templates.has(element) || attributeTemplates.has(element)) applyTemplate(element);
        for (const name of ATTRIBUTES) if (element.hasAttribute?.(name)) translateAttribute(element, name);
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (node.nodeType === Node.TEXT_NODE) translateText(node);
            else {
                if (templates.has(node) || attributeTemplates.has(node)) applyTemplate(node);
                for (const name of ATTRIBUTES) if (node.hasAttribute(name)) translateAttribute(node, name);
            }
        }
    }
    function applyTemplate(element) {
        const entry = templates.get(element);
        if (entry) { const value = i18n.t(entry.source, entry.params); if (element.textContent !== value) element.textContent = value; }
        for (const [name, item] of Object.entries(attributeTemplates.get(element) || {})) element.setAttribute(name, i18n.t(item.source, item.params));
    }
    // 含變數的介面文字：記住原文與參數，切換語言時重新組字。
    function text(element, source, params) {
        templates.set(element, { source, params }); tracked.add(new WeakRef(element)); applyTemplate(element);
    }
    // 含變數的屬性（例如「{label}數值」的輔助說明）。
    function attr(element, name, source, params) {
        const map = attributeTemplates.get(element) || {}; map[name] = { source, params }; attributeTemplates.set(element, map);
        tracked.add(new WeakRef(element)); applyTemplate(element);
    }
    function translateDocumentTitle() {
        const source = document.documentElement.dataset.titleSource ||= document.title;
        if (i18n.isMessage(source)) document.title = i18n.t(source);
    }
    function applyLanguage() {
        document.documentElement.lang = i18n.htmlLang();
        document.documentElement.dataset.language = i18n.language();
        for (const reference of Array.from(tracked)) {
            const node = reference.deref();
            if (!node || !node.isConnected) { tracked.delete(reference); continue; }
            if (node.nodeType === Node.TEXT_NODE) translateText(node);
            else {
                if (templates.has(node) || attributeTemplates.has(node)) applyTemplate(node);
                for (const name of ATTRIBUTES) if (node.hasAttribute(name)) translateAttribute(node, name);
            }
        }
        translateTree(document);
        translateDocumentTitle();
        window.dispatchEvent(new CustomEvent('wavecanvas-language-change', { detail: { language: i18n.language() } }));
    }
    const observer = new MutationObserver(records => {
        for (const record of records) {
            if (record.type === 'characterData') translateText(record.target);
            else if (record.type === 'attributes') translateAttribute(record.target, record.attributeName);
            else for (const node of record.addedNodes) translateTree(node);
        }
    });
    function start() {
        translateTree(document); translateDocumentTitle();
        observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES });
    }
    i18n.subscribe(applyLanguage);
    document.documentElement.lang = i18n.htmlLang();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
    window.WaveCanvasI18nDom = Object.freeze({ text, attr, translate: translateTree });
}());

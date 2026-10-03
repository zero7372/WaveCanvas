(function () {
    'use strict';
    const runtime = window.VisualizerRuntime;
    const owned = new Map();
    const pending = new Map();
    const versions = new Map();
    const names = new Map();
    const sourceFiles = new Map();
    const listeners = new Set();
    const fileKeys = ['logoimage', 'backgroundimage', 'backgroundimagef'];

    function notify() { for (const listener of listeners) listener(); }
    function release(url) { URL.revokeObjectURL(url); window.VisualizerImages.forget(url); }
    function releaseList(urls) { (urls || []).forEach(release); }
    function advance(key) {
        const version = (versions.get(key) || 0) + 1;
        versions.set(key, version);
        releaseList(pending.get(key));
        pending.delete(key);
        return version;
    }

    async function select(key, files) {
        if (runtime.mode !== 'standalone') return;
        if (!fileKeys.includes(key)) throw new Error('Unknown image property');
        if (!files || !files.length) return false; // Cancelling selection retains the current image.
        const version = advance(key);
        const candidates = [];
        pending.set(key, candidates);
        try {
            for (const file of Array.from(files).slice(0, 1)) {
                if (!/\.(png|jpe?g|webp)$/i.test(file.name)) throw new Error('請選擇 PNG、JPG 或 WEBP 圖片。');
                const url = URL.createObjectURL(file);
                candidates.push(url);
                await window.VisualizerImages.load(url);
                if (versions.get(key) !== version) return false;
            }
            const old = owned.get(key);
            owned.set(key, candidates);
            pending.delete(key);
            names.set(key, files[0].name);
            sourceFiles.set(key, files[0]);
            runtime.updateProperties({ [key]: { value: candidates[0] } });
            if (key === 'backgroundimage') {
                runtime.updateProperties({ backgroundsource: { value: 2 } });
                runtime.updateStandalone({ background: { enabled: true } });
            }
            releaseList(old);
            notify();
            return true;
        } catch (error) {
            if (versions.get(key) !== version) return false;
            pending.delete(key);
            releaseList(candidates);
            throw new Error('圖片無法載入：' + error.message);
        }
    }

    function clear(key) {
        advance(key);
        runtime.updateProperties({ [key]: { value: '' } });
    }

    runtime.subscribe(settings => {
        for (const key of fileKeys) {
            const urls = owned.get(key);
            if (!urls) continue;
            const expected = urls[0];
            if (settings[key].value !== expected) {
                releaseList(urls);
                owned.delete(key);
                names.delete(key);
                sourceFiles.delete(key);
            }
        }
        notify();
    });

    function cancelPending() {
        for (const key of fileKeys) advance(key);
    }

    window.addEventListener('pagehide', event => {
        if (event.persisted) return;
        cancelPending();
        for (const urls of owned.values()) releaseList(urls);
        owned.clear();
    });
    window.VisualizerFiles = Object.freeze({
        select, clear, cancelPending,
        getName: key => names.get(key) || '',
        getFile: key => sourceFiles.get(key) || null,
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
    });
}());

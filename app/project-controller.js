(function () {
    'use strict';
    const api = window.waveCanvas?.project;
    if (!api || window.VisualizerRuntime.mode !== 'standalone') return;
    const runtime = window.VisualizerRuntime, serializer = window.WaveCanvasProjectSerializer, model = window.WaveCanvasProjectModel;
    const audio = document.querySelector('#local-audio'), listeners = new Set(), knownFiles = new WeakMap(), pendingFiles = new WeakSet();
    const observedImages = new Map([['cover', window.VisualizerFiles.getFile('logoimage')], ['background', window.VisualizerFiles.getFile('backgroundimage')]]);
    let metadata, media, missingMedia = {}, projectPath = null, lastSavedHash = '', dirty = false, saving = false, restoring = false, failure = '', busy = false;
    let checkTimer = null, tracking = Promise.resolve();
    function initialize() {
        metadata = { projectId: crypto.randomUUID(), name: 'Untitled', appVersion: '0.1.0', createdAt: new Date().toISOString(), modifiedAt: null };
        media = Object.fromEntries(model.slots.map(slot => [slot, null]));
        missingMedia = {};
    }
    initialize();
    function state() { return { name: metadata.name, projectPath, dirty, saving, failure, busy, missingMedia: { ...missingMedia } }; }
    function notify() {
        for (const callback of listeners) callback(state());
        api.status({ name: metadata.name, dirty }).catch(error => console.error('Project title:', error));
    }
    function snapshot() { return serializer.capture(metadata, media); }
    function hash(project) { return model.comparison(project); } // Canonical, collision-free content comparison; no volatile metadata.
    function check() {
        clearTimeout(checkTimer); checkTimer = null;
        if (restoring) return;
        dirty = hash(snapshot()) !== lastSavedHash; notify();
    }
    function markProjectDirty() {
        if (restoring) return;
        dirty = true; failure = ''; notify();
        clearTimeout(checkTimer); checkTimer = setTimeout(check, 150);
    }
    function track(slot, file) {
        if (restoring) return;
        if (file) pendingFiles.add(file);
        tracking = tracking.then(async () => {
            media[slot] = null; // A rejected new reference must never silently retain the previous file's path.
            const reference = file ? knownFiles.has(file) ? knownFiles.get(file) : await api.registerMedia(slot, file) : null;
            if (file) knownFiles.set(file, reference);
            media[slot] = reference; markProjectDirty();
            delete missingMedia[slot]; notify();
        }).catch(error => { failure = error.message; dirty = true; notify(); }).finally(() => { if (file) pendingFiles.delete(file); });
    }
    runtime.subscribe(() => { if (lastSavedHash) markProjectDirty(); });
    window.VisualizerFiles.subscribe(() => {
        for (const [slot, key] of [['cover', 'logoimage'], ['background', 'backgroundimage']]) {
            const file = window.VisualizerFiles.getFile(key);
            const previous = observedImages.get(slot); observedImages.set(slot, file);
            if (restoring || previous === file) continue;
            if (file && !pendingFiles.has(file)) track(slot, file);
            else if (!file && previous) track(slot, null);
        }
    });
    document.addEventListener('click', event => {
        if (event.target.closest('[data-media="cover"] .danger-button')) track('cover', null);
        if (event.target.closest('[data-property="backgroundimage"] button')) track('background', null);
    });
    // Track only committed selections; rejected/cancelled image or lyrics files never change references.
    window.addEventListener('local-audio-change', () => { if (!restoring) track('audio', window.VisualizerLocalAudio.getFile()); });
    window.addEventListener('wavecanvas-lyrics-file', event => track(event.detail.slot, event.detail.file));
    window.VisualizerLyrics.subscribe((value, reason) => {
        if (restoring || reason === 'initial') return;
        if (['load', 'clear', 'audio-change'].includes(reason)) {
            for (const slot of ['primary', 'secondary']) if (!window.VisualizerLyrics.getDocument(slot)) media[slot] = null;
            markProjectDirty();
        }
    });
    async function guard() {
        await tracking; check(); if (!dirty) return true;
        const answer = await api.confirmUnsaved();
        return answer === 1 || answer === 0 && await save('save');
    }
    async function save(kind = 'save') {
        await tracking; check();
        if (saving || restoring) return false;
        if (kind === 'autosave' && (!projectPath || !dirty)) return false;
        const value = snapshot(), before = hash(value);
        if (kind === 'autosave' && before === lastSavedHash) { dirty = false; notify(); return false; }
        for (const [slot, file] of [['audio', window.VisualizerLocalAudio.getFile()], ['cover', window.VisualizerFiles.getFile('logoimage')], ['background', window.VisualizerFiles.getFile('backgroundimage')]]) {
            if (file && !media[slot]) throw new Error('無法取得 ' + slot + ' 的本地路徑；請用桌面檔案選擇器重新匯入。');
        }
        saving = true; failure = ''; notify();
        try {
            const result = await api.save(value, kind);
            if (!result) return false;
            projectPath = result.path; metadata = { ...metadata, name: result.project.name, modifiedAt: result.project.modifiedAt };
            for (const slot of model.slots) if (media[slot] === value.state.media[slot]) media[slot] = result.project.state.media[slot];
            lastSavedHash = hash(result.project); check(); window.dispatchEvent(new Event('wavecanvas-recent-change')); return !dirty;
        } catch (error) { failure = (kind === 'autosave' ? '自動儲存失敗：' : '儲存失敗：') + error.message; dirty = true; console.error(failure); return false; }
        finally { saving = false; notify(); }
    }
    function clearMedia() {
        window.VisualizerLocalAudio.clear();
        for (const key of ['logoimage', 'backgroundimage', 'backgroundimagef']) window.VisualizerFiles.clear(key);
        window.VisualizerLyrics.clear();
    }
    async function restore(loaded) {
        const value = serializer.prepare(loaded.project);
        const files = {}, missing = [];
        // Load/copy into memory before replacing the existing session. Lyrics restore from embedded edited docs.
        for (const slot of ['audio', 'cover', 'background']) {
            const ref = loaded.media[slot]; if (!ref) continue;
            if (ref.missing) { missing.push(slot + ': ' + ref.path); continue; }
            try { const data = await api.readMedia(loaded.token, slot); files[slot] = new File([data.bytes], data.name); }
            catch (error) { missing.push(slot + ': ' + ref.path + ' (' + error.message + ')'); }
        }
        for (const slot of ['primary', 'secondary']) if (loaded.media[slot]?.missing) missing.push(slot + ': ' + loaded.media[slot].path);
        const old = { project: snapshot(), projectPath, lastSavedHash, files: { audio: window.VisualizerLocalAudio.getFile(), cover: window.VisualizerFiles.getFile('logoimage'), background: window.VisualizerFiles.getFile('backgroundimage') } };
        restoring = true;
        try {
            clearMedia(); runtime.restoreProjectSettings(value.state.settings);
            if (files.audio) {
                knownFiles.set(files.audio, value.state.media.audio);
                await new Promise(resolve => {
                    const done = () => { clearTimeout(timer); audio.removeEventListener('loadedmetadata', done); audio.removeEventListener('error', done); resolve(); };
                    const timer = setTimeout(done, 10000); audio.addEventListener('loadedmetadata', done, { once: true }); audio.addEventListener('error', done, { once: true });
                    window.VisualizerLocalAudio.load(files.audio);
                });
                if (audio.error) missing.push('audio: 無法解碼 ' + files.audio.name);
            } else await new Promise(resolve => setTimeout(resolve, 0));
            for (const [slot, key] of [['cover', 'logoimage'], ['background', 'backgroundimage']]) if (files[slot]) {
                knownFiles.set(files[slot], value.state.media[slot]);
                try { await window.VisualizerFiles.select(key, [files[slot]]); } catch (error) { missing.push(slot + ': ' + error.message); }
            }
            // Image selection sets source/enabled. Restore intentional project settings after loading the cache.
            const properties = { ...value.state.settings.properties };
            for (const key of ['logoimage', 'backgroundimage']) properties[key] = runtime.getSettings()[key];
            runtime.updateProperties(properties); runtime.updateStandalone(value.state.settings.standalone);
            window.VisualizerLyrics.restoreDocuments(value.state.lyrics);
            await api.activate(loaded.token);
            metadata = { projectId: value.projectId, name: value.name, appVersion: value.appVersion, createdAt: value.createdAt, modifiedAt: value.modifiedAt };
            media = { ...value.state.media }; projectPath = loaded.path; failure = missing.length ? 'Missing Media：\n' + missing.join('\n') : '';
            missingMedia = Object.fromEntries(Object.entries(loaded.media).filter(([, ref]) => ref?.missing).map(([slot, ref]) => [slot, { name: ref.name, path: ref.path }]));
            // Compare to the normalized state actually restored, preserving missing references.
            lastSavedHash = hash(snapshot()); dirty = false;
            for (const slot of model.slots) {
                const node = document.querySelector('#' + (slot === 'audio' ? 'audio' : slot === 'cover' ? 'cover' : slot) + '-name');
                if (node && loaded.media[slot]?.missing) node.textContent = 'Missing · ' + loaded.media[slot].name;
            }
            window.WaveCanvasShell.showView('EDITOR'); window.dispatchEvent(new Event('wavecanvas-recent-change'));
        } catch (error) {
            clearMedia(); runtime.restoreProjectSettings(old.project.state.settings);
            if (old.files.audio) window.VisualizerLocalAudio.load(old.files.audio);
            for (const [slot, key] of [['cover', 'logoimage'], ['background', 'backgroundimage']]) if (old.files[slot]) await window.VisualizerFiles.select(key, [old.files[slot]]);
            window.VisualizerLyrics.restoreDocuments(old.project.state.lyrics);
            projectPath = old.projectPath; lastSavedHash = old.lastSavedHash; throw error;
        } finally { restoring = false; notify(); }
    }
    async function operation(work) {
        if (busy) return false;
        busy = true; notify();
        try { return await work(); } catch (error) { failure = error.message; notify(); return false; }
        finally { busy = false; notify(); }
    }
    async function open(recentPath) { return operation(async () => { if (!await guard()) return false; const result = await api.open(recentPath); if (!result) return false; await restore(result); return true; }); }
    async function newProject() { return operation(async () => {
        if (!await guard()) return false;
        restoring = true;
        try {
            await api.newProject(); clearMedia();
            await new Promise(resolve => setTimeout(resolve, 0)); // Drain queued audio emptied notifications while restoring is active.
            const baseline = runtime.getStandaloneDefaults('circle');
            runtime.restoreProjectSettings({ properties: runtime.getDefaults('circle'), standalone: baseline,
                layouts: Object.fromEntries(window.VisualizerFactoryDefaults.layouts.map(layout => {
                    const defaults = window.VisualizerFactoryDefaults.get(layout); return [layout, { visualizer: defaults.standalone.visualizer, properties: defaults.properties, text: defaults.standalone.text }];
                })) });
            initialize(); projectPath = null; dirty = false; failure = ''; lastSavedHash = hash(snapshot()); window.WaveCanvasShell.showView('EDITOR');
        } finally { restoring = false; notify(); }
        return true;
    }); }
    async function collect() { return operation(async () => { await tracking; const result = await api.collect(snapshot()); if (!result) return false; if (result.switch) await restore(result.loaded); else { failure = '專案已收集完成：' + result.path; notify(); } return true; }); }
    lastSavedHash = hash(snapshot());
    // One scheduler for the lifetime of this controller, independent of Open/New.
    const interval = setInterval(() => { if (!window.WaveCanvasExport?.getState().busy && !busy && !saving && projectPath && dirty) operation(() => save('autosave')); }, 5 * 60 * 1000);
    const unsubscribeClose = api.onCloseRequested(() => operation(async () => { if (await guard()) await api.finishClose(); }));
    window.addEventListener('pagehide', () => { clearInterval(interval); clearTimeout(checkTimer); unsubscribeClose(); });
    notify();
    window.WaveCanvasProject = Object.freeze({ getState: state, snapshot, markProjectDirty, check, open, newProject, collect,
        save: kind => operation(() => save(kind)), autosave: () => operation(() => save('autosave')),
        subscribe(callback) { listeners.add(callback); callback(state()); return () => listeners.delete(callback); } });
}());

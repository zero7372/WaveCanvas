(function () {
    'use strict';
    const api = window.waveCanvas?.export, audio = document.querySelector('#local-audio');
    const button = [...document.querySelectorAll('.toolbar-actions button')].find(node => node.textContent.trim() === 'Export');
    button.id = 'export-video'; button.textContent = '輸出影片…';
    const menu = document.querySelector('.app-menu>div');
    const command = document.createElement('button'); command.textContent = '輸出影片…'; menu.append(command);
    let busy = false, canceled = false;
    const box = document.createElement('div'); box.id = 'export-progress'; box.hidden = true;
    box.style.cssText = 'position:fixed;right:24px;bottom:24px;z-index:1000;min-width:300px;padding:18px;background:#202329;border:1px solid #535b68;border-radius:8px;box-shadow:0 8px 40px #0009';
    const label = document.createElement('div'), progress = document.createElement('progress'), cancel = document.createElement('button'), reveal = document.createElement('button');
    progress.max = 100; progress.style.cssText = 'width:100%;margin:12px 0;display:block'; cancel.textContent = '取消輸出'; reveal.textContent = '開啟所在資料夾'; reveal.hidden = true;
    box.append(label, progress, cancel, reveal); document.body.append(box);
    function refresh() { button.disabled = command.disabled = !api || busy || !window.VisualizerLocalAudio?.getFile(); button.title = command.title = !api ? '僅 Desktop App 可用' : !window.VisualizerLocalAudio?.getFile() ? '請先載入音訊' : '1920×1080 · 60 FPS · H.264 / AAC'; }
    function lock(value) {
        for (const selector of ['#editor-view', '#home-view', '.app-menus', '#home-button', '.toolbar-actions']) {
            const node = document.querySelector(selector); if (node) node.inert = value;
        }
    }
    async function payload() {
        const assets = {};
        for (const [slot, file] of [['audio', window.VisualizerLocalAudio.getFile()], ['cover', window.VisualizerFiles.getFile('logoimage')], ['background', window.VisualizerFiles.getFile('backgroundimage')], ['overlay', window.VisualizerFiles.getFile('backgroundimagef')]]) {
            if (file) assets[slot] = { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };
        }
        return { snapshot: window.WaveCanvasProject.snapshot(), assets };
    }
    async function start() {
        if (!api || busy || !window.VisualizerLocalAudio.getFile()) return;
        busy = true; canceled = false; refresh(); lock(true);
        const position = audio.currentTime, playing = !audio.paused;
        audio.pause();
        try {
            if (!await api.selectOutput(window.WaveCanvasProject.getState().name)) return;
            box.hidden = false; reveal.hidden = true; cancel.hidden = false; cancel.disabled = false;
            label.textContent = '準備音訊…'; progress.value = 0;
            const snapshot = await payload();
            if (!canceled) await api.start(snapshot);
        } catch (error) { box.hidden = false; label.textContent = error.message; cancel.hidden = true; }
        finally {
            busy = false; lock(false); refresh(); audio.currentTime = position;
            if (playing) audio.play().catch(() => {});
        }
    }
    button.addEventListener('click', start); command.addEventListener('click', start);
    cancel.addEventListener('click', () => { canceled = true; label.textContent = '取消中…'; cancel.disabled = true; api.cancel().catch(error => { label.textContent = error.message; }); });
    document.addEventListener('keydown', event => { if (busy && (event.ctrlKey || event.metaKey)) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
    reveal.addEventListener('click', () => api.reveal().catch(error => { label.textContent = error.message; }));
    api?.onProgress(state => {
        const phases = { preparing: '準備音訊…', rendering: '渲染畫面／編碼…', encoding: '編碼收尾…', finalizing: '完成檔案…', complete: '影片輸出完成', canceled: '已取消影片輸出', error: '影片輸出失敗' };
        label.textContent = state.error || phases[state.phase] + (state.frame ? ' ' + state.frame + ' / ' + state.totalFrames : '');
        if (state.progress !== undefined) progress.value = state.progress;
        if (state.phase === 'finalizing') cancel.disabled = true; // The short atomic commit cannot be rolled back safely.
        if (['complete', 'canceled', 'error'].includes(state.phase)) cancel.hidden = true;
        reveal.hidden = state.phase !== 'complete';
    });
    window.addEventListener('local-audio-change', refresh); refresh();
    window.WaveCanvasExport = Object.freeze({ start, payload, getState: () => ({ busy }) });
}());

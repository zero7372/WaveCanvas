(function () {
    'use strict';
    const runtime = window.VisualizerRuntime;
    if (runtime.mode !== 'standalone') return;
    const lyrics = window.VisualizerLyrics, model = window.VisualizerTimingModel;
    // 放進時間相關的 fieldset；Shell 會把它移到歌詞分頁，整個 Lyrics 群組本身則是隱藏的。
    const content = document.querySelector('[data-lyrics-property="globalOffsetMs"]').parentElement;
    const row = document.createElement('div'); row.className = 'setting-row'; row.dataset.lyricsEnd = '';
    const label = document.createElement('label'); label.htmlFor = 'lyrics-end-time'; label.textContent = '歌詞結束時間（mm:ss.xxx）';
    const input = document.createElement('input'); input.id = label.htmlFor; input.type = 'text'; input.placeholder = '未設定：音訊結束時退場'; input.spellcheck = false;
    const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'quiet-button'; clear.id = 'lyrics-end-clear'; clear.textContent = '清除結束時間';
    const note = document.createElement('small'); note.className = 'setting-note'; note.setAttribute('role', 'status');
    const hint = '最後一句在這個時間退場。SRT 會自動使用最後一句的結束時間。';
    row.append(label, input, clear, note); content.append(row);
    function sync() {
        const end = lyrics.getDocumentEnd(), loaded = Boolean(lyrics.getDocument('primary'));
        row.hidden = !loaded; clear.hidden = end === null;
        if (document.activeElement !== input) input.value = end === null ? '' : model.format(end);
    }
    function commit() {
        try {
            const text = input.value.trim(), before = lyrics.getDocumentEnd();
            const value = text === '' ? null : model.parseTime(text);
            if (value !== before) { lyrics.setDocumentEnd(value); window.WaveCanvasProject?.markProjectDirty(); }
            note.textContent = hint; note.dataset.error = 'false';
        } catch (error) { note.textContent = error.message; note.dataset.error = 'true'; }
        input.blur(); sync();
    }
    input.addEventListener('change', commit);
    input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); commit(); } });
    clear.addEventListener('click', () => { input.value = ''; commit(); });
    note.textContent = hint;
    // 時間列拖曳也可能移動結束時間，所以不只在載入時同步。
    lyrics.subscribe(sync);
}());

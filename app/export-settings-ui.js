(function () {
    'use strict';
    // 影片輸出只在 Desktop App 提供，瀏覽器預覽不顯示這個設定。
    if (!window.waveCanvas?.export) return;
    const settings = window.WaveCanvasExportSettings, max = window.WaveCanvasProjectModel.MAX_TAIL_SECONDS;
    const parent = document.createElement('div');
    const row = document.createElement('div'); row.className = 'setting-row'; row.dataset.exportProperty = 'tailSeconds';
    const label = document.createElement('label'); label.htmlFor = 'export-tailSeconds'; label.textContent = '片尾延長（秒）';
    const pair = document.createElement('div'); pair.className = 'numeric-pair';
    const range = document.createElement('input'); range.type = 'range'; range.id = label.htmlFor;
    const number = document.createElement('input'); number.type = 'number'; number.setAttribute('aria-label', '片尾延長秒數');
    for (const input of [range, number]) {
        input.min = 0; input.max = max; input.step = 0.5;
        input.addEventListener('input', () => { if (input.value !== '') settings.set(Number(input.value)); });
        input.addEventListener('change', () => { if (input.value !== '') settings.set(Number(input.value)); input.value = settings.get(); });
    }
    pair.append(range, number);
    const note = document.createElement('small'); note.className = 'setting-note';
    note.textContent = '音樂結束後繼續輸出畫面，讓歌詞退場、頻譜回落。';
    row.append(label, pair, note);
    // 解析度、影格率與編碼速度存在專案裡，和片尾一樣跟著專案走。
    const formats = window.WaveCanvasExportFormat;
    const choices = {
        resolution: { label: '解析度', options: [['720p', '720p（1280 × 720）'], ['1080p', '1080p（1920 × 1080）'], ['2160p', '4K（3840 × 2160）']] },
        fps: { label: '影格率', options: [[30, '30 fps'], [60, '60 fps']] },
        preset: { label: '編碼速度', options: [['veryfast', '最快（檔案較大）'], ['faster', '較快'], ['medium', '標準（預設）'], ['slow', '較慢（檔案較小）']] }
    };
    const selects = {};
    const grid = document.createElement('div'); grid.className = 'export-format';
    for (const [key, choice] of Object.entries(choices)) {
        const field = document.createElement('div'); field.className = 'setting-row'; field.dataset.exportProperty = key;
        const caption = document.createElement('label'); caption.htmlFor = 'export-' + key; caption.textContent = choice.label;
        const select = document.createElement('select'); select.id = caption.htmlFor;
        for (const [value, text] of choice.options) { const option = document.createElement('option'); option.value = String(value); option.textContent = text; select.append(option); }
        select.addEventListener('change', () => settings.setFormat({ [key]: key === 'fps' ? Number(select.value) : select.value }));
        selects[key] = select; field.append(caption, select); grid.append(field);
    }
    const formatNote = document.createElement('small'); formatNote.className = 'setting-note'; formatNote.id = 'export-format-note';
    parent.append(grid, formatNote, row);
    // 輸出面板：片尾是輸出設定，不屬於任何畫面圖層。
    const dialog = document.createElement('dialog'); dialog.id = 'export-dialog'; dialog.className = 'app-dialog';
    const title = document.createElement('h2'); title.textContent = '輸出影片';
    const summary = document.createElement('p'); summary.className = 'dialog-note'; summary.id = 'export-summary';
    const footer = document.createElement('footer');
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = '取消'; cancel.addEventListener('click', () => dialog.close());
    const confirm = document.createElement('button'); confirm.type = 'button'; confirm.id = 'export-confirm'; confirm.className = 'primary-button'; confirm.textContent = '選擇位置並輸出';
    footer.append(cancel, confirm); dialog.append(title, parent, summary, footer); document.body.append(dialog);
    const audio = document.querySelector('#local-audio');
    const clock = seconds => Math.floor(seconds / 60).toString().padStart(2, '0') + ':' + Math.floor(seconds % 60).toString().padStart(2, '0');
    function describe() {
        const music = Number.isFinite(audio.duration) ? audio.duration : 0, seconds = settings.get();
        const format = formats.resolve(settings.getFormat());
        window.WaveCanvasI18nDom.text(summary, '{width} × {height}，{fps} fps，H.264。影片總長 {total}，音樂 {music}。', { width: format.width, height: format.height, fps: format.fps, total: clock(music + seconds), music: clock(music) });
        for (const [key, select] of Object.entries(selects)) select.value = String(format[key]);
        window.WaveCanvasI18nDom.text(formatNote, format.resolution === '2160p' ? '4K 的文字與圖片以 4K 繪製，頻譜與粒子由 1080p 放大；輸出時間約為 1080p 的 3 到 4 倍。'
            : format.resolution === '720p' ? '由 1080p 畫面縮小，輸出時間與 1080p 相近。' : '畫布原生解析度。');
    }
    settings.subscribe(describe);
    window.WaveCanvasExportDialog = Object.freeze({ open(start) { describe(); confirm.onclick = () => { dialog.close(); start(); }; dialog.showModal(); confirm.focus(); } });
    settings.subscribe(value => { range.value = value; number.value = value; });
}());

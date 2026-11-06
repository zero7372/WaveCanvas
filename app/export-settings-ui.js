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
    row.append(label, pair, note); parent.append(row);
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
        summary.textContent = '1920 × 1080，60 fps，H.264。影片總長 ' + clock(music + seconds) + '，音樂 ' + clock(music) + '。';
    }
    settings.subscribe(describe);
    window.WaveCanvasExportDialog = Object.freeze({ open(start) { describe(); confirm.onclick = () => { dialog.close(); start(); }; dialog.showModal(); confirm.focus(); } });
    settings.subscribe(value => { range.value = value; number.value = value; });
}());

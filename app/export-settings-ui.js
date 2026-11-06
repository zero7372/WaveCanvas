(function () {
    'use strict';
    // 影片輸出只在 Desktop App 提供，瀏覽器預覽不顯示這個設定。
    if (!window.waveCanvas?.export) return;
    const settings = window.WaveCanvasExportSettings, max = window.WaveCanvasProjectModel.MAX_TAIL_SECONDS;
    const parent = document.querySelector('[data-group="Audio"] .group-content');
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
    note.textContent = '音樂結束後繼續輸出畫面與靜音，讓歌詞退場、頻譜回落。只影響影片輸出，預覽不會延長。';
    row.append(label, pair, note); parent.append(row);
    settings.subscribe(value => { range.value = value; number.value = value; });
}());

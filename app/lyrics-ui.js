(function () {
    'use strict';
    const runtime = window.VisualizerRuntime;
    if (runtime.mode !== 'standalone') return;
    const lyrics = window.VisualizerLyrics;
    function element(tag, className, text) {
        const node = document.createElement(tag); if (className) node.className = className;
        if (text !== undefined) node.textContent = text; return node;
    }
    const group = element('details', 'settings-group lyrics-controls'); group.dataset.group = 'Lyrics';
    group.append(element('summary', '', '歌詞'));
    const content = element('div', 'group-content'); group.append(content);
    const fileLabel = element('label', '', '主要歌詞（LRC / SRT，可含同時間雙語）'); fileLabel.htmlFor = 'lyrics-file';
    const file = element('input'); file.id = fileLabel.htmlFor; file.type = 'file'; file.accept = window.VisualizerLyricsImport.accept;
    const clear = element('button', 'quiet-button', '清除歌詞'); clear.type = 'button'; clear.id = 'lyrics-clear';
    const status = element('span', 'lyrics-file-status', '尚未載入歌詞'); status.id = 'lyrics-file-status'; status.setAttribute('role', 'status');
    const fileRow = element('div', 'setting-row'); fileRow.append(fileLabel, file, clear, status); content.append(fileRow);
    const secondaryLabel = element('label', '', '次要歌詞（LRC / SRT，選用，依時間配對）'); secondaryLabel.htmlFor = 'lyrics-secondary-file';
    const secondaryFile = element('input'); secondaryFile.type = 'file'; secondaryFile.accept = window.VisualizerLyricsImport.accept; secondaryFile.id = secondaryLabel.htmlFor;
    const secondaryClear = element('button', 'quiet-button', '清除次要歌詞'); secondaryClear.type = 'button'; secondaryClear.id = 'lyrics-secondary-clear';
    const secondaryRow = element('div', 'setting-row'); secondaryRow.append(secondaryLabel, secondaryFile, secondaryClear); content.append(secondaryRow);
    let version = 0, secondaryVersion = 0;
    lyrics.subscribe((state, reason) => {
        if (['load', 'clear', 'audio-change', 'initial'].includes(reason)) {
            if (reason === 'audio-change' || reason === 'clear') { version++; secondaryVersion++; }
            status.dataset.error = 'false';
            status.textContent = state.count ? state.name + ' · ' + state.count + ' 句 · 檔案偏移 ' + state.fileOffsetMs + ' 毫秒'
                + (state.secondaryName ? ' · 次要：' + state.secondaryName + '（偏移 ' + state.secondaryFileOffsetMs + ' 毫秒）' : '')
                + (state.warnings ? ' · ' + state.warnings + ' 筆匯入警告／忽略項目' : '') : state.name ? '此檔案沒有有效的逐行歌詞。'
                    : state.secondaryName ? '已載入次要：' + state.secondaryName + '；請選擇主要 LRC 建立時間線。' : '尚未載入歌詞';
        }
    });
    file.addEventListener('change', async () => {
        const selected = file.files[0]; file.value = ''; if (!selected) return;
        const selection = ++version;
        try {
            window.VisualizerLyricsImport.validateFile(selected);
            const text = await selected.text();
            if (selection !== version) return;
            lyrics.load(text, selected.name);
            window.dispatchEvent(new CustomEvent('wavecanvas-lyrics-file', { detail: { slot: 'primary', file: selected } }));
        } catch (error) { if (selection === version) { status.textContent = error.message; status.dataset.error = 'true'; } }
    });
    clear.addEventListener('click', () => lyrics.clear());
    secondaryFile.addEventListener('change', async () => {
        const selected = secondaryFile.files[0]; secondaryFile.value = ''; if (!selected) return;
        const selection = ++secondaryVersion;
        try {
            window.VisualizerLyricsImport.validateFile(selected);
            const text = await selected.text(); if (selection !== secondaryVersion) return;
            lyrics.loadSecondary(text, selected.name);
            window.dispatchEvent(new CustomEvent('wavecanvas-lyrics-file', { detail: { slot: 'secondary', file: selected } }));
        } catch (error) { if (selection === secondaryVersion) { status.textContent = error.message; status.dataset.error = 'true'; } }
    });
    secondaryClear.addEventListener('click', () => { secondaryVersion++; lyrics.clearSecondary(); });
    const sections = { enabled: '顯示與字型', currentColor: '顏色與位置', showPrevious: '焦點切換', glowEnabled: '低頻背光', globalOffsetMs: '時間同步', secondaryEnabled: '雙語顯示' };
    let parent = content;
    const controls = new Map();
    for (const [key, definition] of Object.entries(window.VisualizerLyricsSettings.properties)) {
        if (sections[key]) { parent = element('fieldset'); parent.append(element('legend', '', sections[key])); content.append(parent); }
        const row = element('div', 'setting-row'); row.dataset.lyricsProperty = key;
        const label = element('label', '', definition.text); label.htmlFor = 'lyrics-' + key;
        const input = element(definition.type === 'combo' ? 'select' : 'input'); input.id = label.htmlFor;
        const inputs = [input]; row.append(label);
        if (definition.type === 'slider') {
            input.type = 'range'; const numeric = element('input'); numeric.type = 'number'; numeric.setAttribute('aria-label', definition.text + '數值'); inputs.push(numeric);
            for (const node of inputs) { node.min = definition.min; node.max = definition.max; node.step = definition.step; }
            const pair = element('div', 'numeric-pair'); pair.append(...inputs); row.append(pair);
        } else if (definition.type === 'combo') {
            for (const option of definition.options) { const node = element('option', '', option.label); node.value = option.value; if (key === 'fontFamily' || key === 'secondaryFontFamily') node.style.fontFamily = window.VisualizerSystemFonts.fontStack(option.value); input.append(node); }
            row.append(input);
        } else if (definition.type === 'bool') { input.type = 'checkbox'; row.classList.add('bool-row'); row.append(input); }
        else { input.type = 'color'; const value = element('output', 'color-value'); row.append(input, value); inputs.push(value); }
        function commit(node, final = false) {
            let value = definition.type === 'bool' ? node.checked : node.value;
            if (definition.type === 'slider' || key === 'fontWeight') value = Number(value);
            if (definition.type === 'slider' && (node.value === '' || !Number.isFinite(value) || !final && (value < definition.min || value > definition.max))) return;
            try { runtime.updateStandalone({ lyrics: { [key]: value } }); }
            catch (error) { status.textContent = error.message; status.dataset.error = 'true'; }
        }
        for (const node of inputs.filter(node => node.tagName !== 'OUTPUT')) {
            node.addEventListener(definition.type === 'slider' || definition.type === 'color' ? 'input' : 'change', () => commit(node));
            if (definition.type === 'slider') node.addEventListener('change', () => { commit(node, true); sync(runtime.getStandalone().lyrics); });
        }
        if (key === 'globalOffsetMs') row.append(element('small', 'setting-note', '正值＝歌詞提早；負值＝歌詞延後。與 LRC 檔案 offset 相加。'));
        if (key === 'secondaryOffsetMs') row.append(element('small', 'setting-note', '正值讓次要檔案時間提早，負值延後；校準後在容差內配對。雙語仍共用主要時間線。'));
        if (key === 'maxWidth') row.append(element('small', 'setting-note', '64 像素安全邊界；長句自動換行，最多 3 行，必要時縮至 1–2 行並截斷。'));
        parent.append(row); controls.set(key, { inputs, definition });
    }
    const syncFonts = ['fontFamily', 'secondaryFontFamily'].map(key => window.VisualizerSystemFonts.bindSelect(controls.get(key).inputs[0], () => runtime.getStandalone().lyrics[key]));
    function sync(settings) {
        for (const [key, { inputs, definition }] of controls) for (const input of inputs) {
            if (input.tagName === 'OUTPUT') input.textContent = settings[key].toUpperCase();
            else if (definition.type === 'bool') input.checked = settings[key]; else input.value = settings[key];
        }
        controls.get('glowColor').inputs[0].closest('.setting-row').hidden = settings.glowColorMode !== 'custom';
        for (const syncFont of syncFonts) syncFont();
    }
    runtime.subscribe((_, standalone) => sync(standalone.lyrics));
    document.querySelector('#settings-groups').append(group);
}());

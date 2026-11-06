(function () {
    'use strict';
    const runtime = window.VisualizerRuntime;
    const $ = selector => document.querySelector(selector);
    if (runtime.mode !== 'standalone') { $('#home-view').hidden = true; $('#transport').hidden = true; $('#future-timing').hidden = true; $('#media-panel').hidden = true; $('.editor-strip').hidden = true; window.dispatchEvent(new Event('resize')); return; }
    const audio = $('#local-audio');
    let view = 'HOME', entered = false;
    const text = (node, value) => { if (node.textContent !== value) node.textContent = value; };
    const time = value => { value = Number.isFinite(value) ? Math.max(0, value) : 0; return Math.floor(value / 60).toString().padStart(2, '0') + ':' + Math.floor(value % 60).toString().padStart(2, '0'); };
    function fit() { window.dispatchEvent(new Event('resize')); }
    function showView(next) {
        view = next; $('#home-view').hidden = next !== 'HOME'; $('#editor-view').hidden = next !== 'EDITOR';
        document.body.dataset.view = next;
        window.dispatchEvent(new Event('wavecanvas-view-change'));
        if (next === 'EDITOR') {
            if (!entered && $('#settings-panel').hidden && window.innerWidth > 900) $('#settings-toggle').click();
            entered = true; $('#new-project').firstChild.textContent = '繼續編輯 '; $('#new-project small').textContent = '回到目前的專案';
        }
        else audio.pause(); // Home retains every loaded resource and setting.
        fit();
    }
    function panel(id, open) {
        $('#' + id + '-panel').hidden = !open;
        $('#' + id + '-toggle').setAttribute('aria-expanded', String(open));
        document.body.dataset[id + 'Open'] = String(open); fit();
    }
    $('#media-toggle').addEventListener('click', () => panel('media', $('#media-panel').hidden));
    $('#media-close').addEventListener('click', () => panel('media', false));
    // Existing settings handlers retain ownership of opening/closing the Inspector.
    new MutationObserver(() => { document.body.dataset.settingsOpen = String(!$('#settings-panel').hidden); }).observe($('#settings-panel'), { attributes: true, attributeFilter: ['hidden'] });
    $('#home-button').addEventListener('click', () => showView('HOME'));
    $('#new-project').addEventListener('click', () => showView('EDITOR'));
    $('#explore-templates').addEventListener('click', () => { $('#template-gallery').scrollIntoView({ block: 'nearest' }); $('#template-gallery').focus({ preventScroll: true }); });
    function command(name) {
        if (name.startsWith('open-')) {
            showView('EDITOR');
            const inputs = { 'open-audio': '#audio-file', 'open-cover': '#setting-logoimage', 'open-primary': '#lyrics-file', 'open-secondary': '#lyrics-secondary-file' };
            $(inputs[name]).click();
        } else if (name === 'home') showView('HOME');
        else if (name === 'editor') showView('EDITOR');
        else if (name === 'media-toggle') $('#media-toggle').click();
        else if (name === 'settings-toggle') $('#settings-toggle').click();
        else if (name === 'timing-toggle') { $('#future-timing').open = !$('#future-timing').open; showView('EDITOR'); fit(); }
        else if (name === 'preset-import') $('#import-preset-button').click();
        else if (name === 'preset-export') $('#export-preset').click();
        else if (name === 'preset-reset') $('#reset-defaults').click();
    }
    for (const button of document.querySelectorAll('[data-command]')) button.addEventListener('click', () => { command(button.dataset.command); for (const menu of document.querySelectorAll('.app-menu')) menu.open = false; });
    $('#open-media').addEventListener('click', () => command('open-audio'));
    for (const menu of document.querySelectorAll('.app-menu')) menu.addEventListener('toggle', () => {
        if (menu.open) for (const other of document.querySelectorAll('.app-menu')) if (other !== menu) other.open = false;
    });
    document.addEventListener('click', event => { if (!event.target.closest('.app-menu')) for (const menu of document.querySelectorAll('.app-menu')) menu.open = false; });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') for (const menu of document.querySelectorAll('.app-menu')) menu.open = false; });

    // Reparent the existing controls, preserving their handlers and runtime subscriptions.
    const presetMenu = document.querySelectorAll('.app-menu')[2].querySelector('div');
    presetMenu.replaceChildren($('.preset-tools'));
    $('#export-preset').textContent = '儲存預設組'; $('#import-preset-button').textContent = '載入預設組';
    const coverRow = $('[data-property="logoimage"]'); $('#cover-controls').append(coverRow);
    coverRow.querySelector('label').classList.add('sr-only'); coverRow.querySelector('input').hidden = true;
    coverRow.querySelector('.file-name').hidden = true;
    for (const [input, destination] of [['#lyrics-file', '#primary-controls'], ['#lyrics-secondary-file', '#secondary-controls']]) {
        const row = $(input).closest('.setting-row'); $(destination).append(row);
        row.querySelector('label').classList.add('sr-only'); $(input).hidden = true;
    }
    // Move the existing clear buttons after the main action; keep their original handlers.
    for (const [media, button] of [['cover', coverRow.querySelector('button')], ['primary', $('#lyrics-clear')], ['secondary', $('#lyrics-secondary-clear')]]) {
        button.classList.add('danger-button');
        $('[data-media="' + media + '"] footer').append(button);
    }
    const primaryStatus = $('#lyrics-file-status'); primaryStatus.classList.add('media-note');
    $('[data-media="primary"]').insertBefore(primaryStatus, $('[data-media="primary"] footer'));
    $('#lyrics-clear').textContent = '移除'; $('#lyrics-secondary-clear').textContent = '移除'; $('[data-media="cover"] .danger-button').textContent = '移除';
    // 圖層清單同時取代原本的素材面板與設定分頁；所有控制項都沿用既有節點與事件。
    const structure = window.WaveCanvasLayerStructure, layers = structure.layers;
    const panels = new Map(), root = $('#settings-groups'), list = $('#layer-list');
    const legacyGroups = Array.from(root.children), summaries = new Map();
    for (const layer of layers) {
        const button = document.createElement('button'); button.id = 'layer-' + layer.id; button.type = 'button'; button.className = 'layer-item'; button.setAttribute('role', 'tab');
        button.setAttribute('aria-controls', 'inspector-' + layer.id); button.dataset.layer = layer.id; if (layer.separated) button.dataset.separated = 'true';
        const icon = document.createElement('span'); icon.className = 'layer-icon'; icon.innerHTML = layer.icon;
        const name = document.createElement('span'); name.className = 'layer-name'; name.textContent = layer.name;
        const detail = document.createElement('small'); detail.className = 'layer-detail'; summaries.set(layer.id, detail);
        const words = document.createElement('span'); words.className = 'layer-words'; words.append(name, detail);
        button.append(icon, words); list.append(button);
        const pane = document.createElement('section'); pane.id = 'inspector-' + layer.id; pane.className = 'inspector-tab'; pane.setAttribute('role', 'tabpanel'); pane.setAttribute('aria-labelledby', button.id); pane.hidden = true; panels.set(layer.id, pane);
        button.addEventListener('click', () => selectLayer(layer.id));
        button.addEventListener('keydown', event => {
            if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault(); const index = layers.indexOf(layer);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? layers.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + layers.length) % layers.length;
            selectLayer(layers[next].id); $('#layer-' + layers[next].id).focus();
        });
    }
    root.append(...panels.values());
    // 舊群組保留為隱藏的整合節點，內容全部移到圖層。
    for (const group of legacyGroups) group.hidden = true;
    function positionProxy(name, label) {
        const { scope, key, canvas } = structure.proxies[name];
        const read = () => scope === 'properties' ? runtime.getSettings()[key].value : runtime.getStandalone()[scope][key];
        const write = value => scope === 'properties' ? runtime.updateProperties({ [key]: { value } }) : runtime.updateStandalone({ [scope]: { [key]: value } });
        const original = $(structure.selector(scope === 'properties' ? 'p' : 'b', key)); original.dataset.proxied = 'true';
        const source = original.querySelector('input[type=range]'), toPercent = pixels => 50 + pixels / canvas * 100;
        const row = document.createElement('div'); row.className = 'setting-row'; row.dataset.positionProxy = name;
        const title = document.createElement('label'); title.textContent = label; title.htmlFor = 'position-' + name;
        const range = document.createElement('input'); range.type = 'range'; range.id = title.htmlFor;
        const number = document.createElement('input'); number.type = 'number'; number.setAttribute('aria-label', label + '數值');
        for (const input of [range, number]) {
            input.min = Math.round(toPercent(Number(source.min)) * 10) / 10; input.max = Math.round(toPercent(Number(source.max)) * 10) / 10; input.step = .1;
            input.addEventListener('input', () => { if (input.value !== '') write(Math.min(Number(source.max), Math.max(Number(source.min), Math.round((Number(input.value) - 50) / 100 * canvas)))); });
        }
        const pair = document.createElement('div'); pair.className = 'numeric-pair has-restore'; pair.append(range, number); row.append(title, pair);
        runtime.subscribe(() => {
            const value = Math.round(toPercent(read()) * 10) / 10;
            row.hidden = original.hidden;
            if (document.activeElement !== number) number.value = value;
            range.value = value;
        });
        return { row, original };
    }
    function section(parent, definition) {
        const details = document.createElement('details'); details.className = 'settings-group'; details.open = true;
        const summary = document.createElement('summary'); summary.textContent = definition.title;
        const content = document.createElement('div'); content.className = 'group-content'; details.append(summary, content); parent.append(details);
        for (const media of definition.media || []) content.append($('[data-media="' + media + '"]'));
        for (const [kind, key, label] of definition.rows || []) {
            if (kind === 'proxy') { const { row, original } = positionProxy(key, label); content.append(row, original); continue; }
            const node = $(structure.selector(kind, key)); const row = kind === 'input' ? node.closest('.setting-row') : node;
            if (kind !== 'end') {
                row.querySelector('label').textContent = label;
                const number = row.querySelector('input[type=number]'); if (number) number.setAttribute('aria-label', label + '數值');
            }
            content.append(row);
        }
    }
    for (const layer of layers) for (const definition of layer.sections) section(panels.get(layer.id), definition);
    // 次要、進階的區段預設收合，減少第一眼要讀的項目。
    for (const [layer, title] of [['background', '疊加圖片'], ['lyrics', '切換動畫'], ['lyrics', '上下句'], ['lyrics', '次要歌詞'], ['song', '外框'], ['audio', '預覽']]) {
        for (const details of panels.get(layer).querySelectorAll('.settings-group')) if (details.querySelector('summary').textContent === title) details.open = false;
    }
    function selectLayer(id) {
        for (const [key, pane] of panels) { pane.hidden = key !== id; const button = $('#layer-' + key); button.setAttribute('aria-selected', String(key === id)); button.tabIndex = key === id ? 0 : -1; }
        $('#layer-title').textContent = $('#layer-' + id + ' .layer-name').textContent;
        $('#settings-panel .panel-scroll').scrollTop = 0;
    }
    const layoutNames = { circle: '放射圓形', square: '方形', linear: '直線' };
    const style = { 1: '樣式一', 2: '樣式二' };
    function summarize() {
        const properties = runtime.getSettings(), standalone = runtime.getStandalone(), files = window.VisualizerFiles;
        const source = properties.backgroundsource.value;
        text(summaries.get('audio'), window.VisualizerLocalAudio.getName() || '未載入');
        text(summaries.get('background'), source === 2 ? (files.getName('backgroundimage') || '未選圖片') : source === 1 ? '純色' : '無');
        text(summaries.get('spectrum'), layoutNames[standalone.visualizer.layout]);
        text(summaries.get('center'), files.getName('logoimage') || '未載入');
        text(summaries.get('particles'), style[properties.particlestyle.value] || '');
        const lyrics = window.VisualizerLyrics.getState();
        text(summaries.get('lyrics'), !standalone.lyrics.enabled ? '已隱藏' : lyrics.name || '未載入');
        text(summaries.get('song'), !standalone.text.enabled ? '已隱藏' : standalone.text.title || '未填寫');
    }
    runtime.subscribe(summarize); window.VisualizerFiles.subscribe(summarize); window.VisualizerLyrics.subscribe(summarize); window.addEventListener('local-audio-change', summarize);
    selectLayer('spectrum');

    function audioInfo() {
        text($('#audio-name'), window.VisualizerLocalAudio.getName() || '尚未載入音訊');
        text($('#audio-meta'), Number.isFinite(audio.duration) ? time(audio.duration) : 'WAV、MP3 或 FLAC');
        $('#audio-clear').disabled = !audio.getAttribute('src');
    }
    $('#audio-clear').addEventListener('click', () => window.VisualizerLocalAudio.clear());
    window.addEventListener('local-audio-change', () => { audioInfo(); transport(); if (audio.getAttribute('src')) showView('EDITOR'); });
    window.VisualizerFiles.subscribe(() => {
        const name = window.VisualizerFiles.getName('logoimage'), url = runtime.getSettings().logoimage.value;
        text($('#cover-name'), name || '尚未載入圖片'); text($('#cover-meta'), 'PNG、JPG 或 WEBP');
        // Read the already decoded cache; the drawing reference commits asynchronously.
        if (name && url) window.VisualizerImages.load(url).then(image => {
            if (runtime.getSettings().logoimage.value === url) text($('#cover-meta'), image.naturalWidth + ' × ' + image.naturalHeight);
        }).catch(() => {});
    });
    window.VisualizerLyrics.subscribe((state, reason) => {
        if (!['initial','load','clear','audio-change'].includes(reason)) return;
        primaryStatus.dataset.warning = String(Boolean(state.warnings));
        text($('#primary-name'), state.name || '尚未載入主要歌詞'); text($('#primary-meta'), state.name ? (state.sourceFormat || 'lrc').toUpperCase() + '，' + state.count + ' 句' : 'LRC 或 SRT，可含雙語');
        text($('#secondary-name'), state.secondaryName || '尚未載入次要歌詞'); text($('#secondary-meta'), state.secondaryName ? (state.secondarySourceFormat || 'lrc').toUpperCase() + '，依時間配對' : '選用，依時間與主要歌詞配對');
    });
    function transport() {
        const ready = !!audio.getAttribute('src') && Number.isFinite(audio.duration) && !audio.error;
        $('#play-pause').disabled = !ready; $('#rewind').disabled = !ready; $('#transport-seek').disabled = !ready;
        $('#play-pause').dataset.state = audio.paused ? 'play' : 'pause'; $('#play-pause').setAttribute('aria-label', audio.paused ? '播放' : '暫停');
        text($('#current-time'), time(audio.currentTime)); text($('#duration'), time(audio.duration));
        $('#transport-seek').max = ready ? audio.duration : 1; $('#transport-seek').value = audio.currentTime || 0;
        $('#transport-volume').value = audio.volume;
    }
    for (const event of ['timeupdate','durationchange','loadedmetadata','play','pause','ended','emptied','volumechange','error']) audio.addEventListener(event, () => { transport(); audioInfo(); });
    $('#play-pause').addEventListener('click', () => { if (audio.paused) audio.play().catch(error => text($('#shell-status'), error.message)); else audio.pause(); });
    $('#rewind').addEventListener('click', () => { audio.currentTime = 0; });
    $('#transport-seek').addEventListener('input', event => { if (Number.isFinite(audio.duration)) audio.currentTime = Number(event.target.value); });
    $('#transport-volume').addEventListener('input', event => { audio.volume = Number(event.target.value); });
    $('#preview-fit').addEventListener('click', fit);
    $('#preview-fullscreen').disabled = !$('#preview-region').requestFullscreen;
    $('#preview-fullscreen').addEventListener('click', async () => {
        try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('#preview-region').requestFullscreen(); }
        catch { text($('#shell-status'), '此環境無法啟用全螢幕預覽。'); }
    });
    $('#future-timing').addEventListener('toggle', fit);
    // Narrow layouts stack the panels beneath the preview; no overlay or Stage distortion.
    panel('media', window.innerWidth > 900);
    transport(); audioInfo(); showView('HOME');
    window.WaveCanvasShell = Object.freeze({ showView, selectLayer, getView: () => view, hasSession: () => entered });
}());

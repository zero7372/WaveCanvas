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
            entered = true; $('#new-project').firstChild.textContent = '↗ 繼續編輯 '; $('#new-project small').textContent = '保留目前工作階段';
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
    const tabs = [['visualizer', '視覺'], ['lyrics', '歌詞'], ['song', '歌曲資訊'], ['background', '背景'], ['audio', '音訊']];
    const panels = new Map();
    const root = $('#settings-groups');
    for (const [id, label] of tabs) {
        const button = document.createElement('button'); button.id = 'tab-' + id; button.type = 'button'; button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', 'inspector-' + id); button.textContent = label; button.dataset.tab = id;
        $('#settings-tabs').append(button);
        const pane = document.createElement('section'); pane.id = 'inspector-' + id; pane.className = 'inspector-tab'; pane.setAttribute('role', 'tabpanel'); pane.setAttribute('aria-labelledby', button.id); pane.hidden = true; panels.set(id, pane);
        button.addEventListener('click', () => selectTab(id));
        button.addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault(); const index = tabs.findIndex(tab => tab[0] === id);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
            selectTab(tabs[next][0]); $('#tab-' + tabs[next][0]).focus();
        });
    }
    for (const group of Array.from(root.children)) {
        const name = group.dataset.group;
        const target = name === 'Audio' ? 'audio' : ['Background', 'Overlay'].includes(name) ? 'background' : name === 'Lyrics' ? 'lyrics' : name === 'Song Info' ? 'song' : 'visualizer';
        panels.get(target).append(group);
    }
    root.append(...panels.values());
    function section(parent, title, rows) {
        const details = document.createElement('details'); details.className = 'settings-group'; details.open = true;
        const summary = document.createElement('summary'); summary.textContent = title;
        const content = document.createElement('div'); content.className = 'group-content'; content.append(...rows); details.append(summary, content); parent.append(details);
    }
    // Existing fieldsets become collapsible sections without rebuilding any controls.
    const lyricsGroup = $('[data-group="Lyrics"]');
    for (const fieldset of Array.from(lyricsGroup.querySelectorAll('fieldset'))) {
        section(panels.get('lyrics'), fieldset.querySelector('legend').textContent, Array.from(fieldset.children).filter(node => node.tagName !== 'LEGEND'));
    }
    lyricsGroup.hidden = true;
    const songGroup = $('[data-group="Song Info"]');
    const songSections = { '內容': ['enabled','title','artist'], '字體與顏色': ['fontFamily','titleSizeRatio','artistSizeRatio','color'], '對齊與位置': ['alignment','positionX','positionY','scale','lineGap'], '邊框／外發光': ['borderEnabled','borderColor','borderWidth','borderBlur'], '低頻反應': ['bassReaction','bassStrength'] };
    for (const [label, keys] of Object.entries(songSections)) section(panels.get('song'), label, keys.map(key => $('[data-text-property="' + key + '"]')));
    // Keep the original metadata wrapper for existing integration hooks, without a duplicate UI.
    songGroup.hidden = true;
    function selectTab(id) {
        for (const [key, pane] of panels) { pane.hidden = key !== id; const button = $('#tab-' + key); button.setAttribute('aria-selected', String(key === id)); button.tabIndex = key === id ? 0 : -1; }
    }
    selectTab('visualizer');
    $('[data-group="Geometry / Layout"]').open = true;

    function audioInfo() {
        text($('#audio-name'), window.VisualizerLocalAudio.getName() || '尚未載入音訊');
        text($('#audio-meta'), Number.isFinite(audio.duration) ? time(audio.duration) : 'WAV / MP3 / FLAC');
        $('#audio-clear').disabled = !audio.getAttribute('src');
    }
    $('#audio-clear').addEventListener('click', () => window.VisualizerLocalAudio.clear());
    window.addEventListener('local-audio-change', () => { audioInfo(); transport(); if (audio.getAttribute('src')) showView('EDITOR'); });
    window.VisualizerFiles.subscribe(() => {
        const name = window.VisualizerFiles.getName('logoimage'), url = runtime.getSettings().logoimage.value;
        text($('#cover-name'), name || '尚未載入封面'); text($('#cover-meta'), 'PNG / JPG / WEBP');
        // Read the already decoded cache; the drawing reference commits asynchronously.
        if (name && url) window.VisualizerImages.load(url).then(image => {
            if (runtime.getSettings().logoimage.value === url) text($('#cover-meta'), image.naturalWidth + ' × ' + image.naturalHeight);
        }).catch(() => {});
    });
    window.VisualizerLyrics.subscribe((state, reason) => {
        if (!['initial','load','clear','audio-change'].includes(reason)) return;
        primaryStatus.dataset.warning = String(Boolean(state.warnings));
        text($('#primary-name'), state.name || '尚未載入主要歌詞'); text($('#primary-meta'), state.name ? (state.sourceFormat || 'lrc').toUpperCase() + ' · ' + state.count + ' 句 · offset ' + state.fileOffsetMs + ' ms' : 'LRC / SRT · 可含雙語');
        text($('#secondary-name'), state.secondaryName || '尚未載入次要歌詞'); text($('#secondary-meta'), state.secondaryName ? (state.secondarySourceFormat || 'lrc').toUpperCase() + ' · 已載入 · 依時間戳配對' : 'LRC / SRT · 選用，依時間戳配對');
    });
    function transport() {
        const ready = !!audio.getAttribute('src') && Number.isFinite(audio.duration) && !audio.error;
        $('#play-pause').disabled = !ready; $('#rewind').disabled = !ready; $('#transport-seek').disabled = !ready;
        text($('#play-pause'), audio.paused ? '▶' : 'Ⅱ'); $('#play-pause').setAttribute('aria-label', audio.paused ? '播放' : '暫停');
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
    window.WaveCanvasShell = Object.freeze({ showView, selectTab, getView: () => view, hasSession: () => entered });
}());

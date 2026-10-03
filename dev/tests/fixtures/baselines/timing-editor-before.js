(function () {
    'use strict';
    const runtime = window.VisualizerRuntime;
    if (runtime.mode !== 'standalone') return;
    const model = window.VisualizerTimingModel, lyrics = window.VisualizerLyrics, waveform = window.VisualizerWaveform;
    const $ = selector => document.querySelector(selector), audio = $('#local-audio');
    const panel = $('#future-timing'), editor = $('#timing-editor'), scroll = $('#timing-scroll'), content = $('#timing-content');
    const canvas = $('#timing-waveform'), head = $('#timing-playhead'), status = $('#timing-status');
    const docs = { primary: null, secondary: null }, nodes = new Map(), downloads = new Map();
    let scale = 50, map = model.mapping(scale), width = 1, extent = 30, selected = null, drag = null;
    let revision = -1, settings = runtime.getStandalone().lyrics, peaks = null, waveVersion = 0, waveState = '尚未載入音訊，仍可校時 LRC。';
    let frame = null, manualUntil = 0, lastActive = { primary: null, secondary: null };
    const editableTarget = target => target.closest('input,textarea,select,[contenteditable=true]');
    const visible = () => panel.open && !$('#editor-view').hidden;
    function message(text, error = false) { status.textContent = text; status.dataset.error = String(error); }
    function duration() { return Number.isFinite(audio.duration) && audio.getAttribute('src') ? audio.duration : Infinity; }
    function eventFor(selection = selected) { return selection && docs[selection.source]?.events.find(event => event.id === selection.id); }
    function offsets(source) { return (docs[source]?.fileOffsetMs || 0) + settings.globalOffsetMs + (source === 'secondary' ? settings.secondaryOffsetMs : 0); }
    function offsetUI() { $('#timing-offsets').textContent = 'Raw LRC · offsets 另計：Primary ' + offsets('primary') + ' ms / Secondary ' + offsets('secondary') + ' ms'; }
    function xTime(event) { return map.timeToX(event.timeMs / 1000); }
    function seek(seconds) {
        if (!Number.isFinite(duration())) { message('請先載入音訊以使用 Seek。'); return; }
        audio.currentTime = Math.max(0, Math.min(duration(), seconds)); updatePlayback();
    }
    function seekSelected() {
        const event = eventFor();
        // Chromium may truncate a decimal seek one microsecond before the cue.
        if (event) seek((event.timeMs - offsets(selected.source)) / 1000 + .000001);
    }
    const history = model.history((edit, timeMs) => {
        if (docs[edit.source]?.id !== edit.documentId) return;
        selected = { source: edit.source, id: edit.id }; lyrics.retime(edit.source, edit.id, timeMs); selectionUI();
    });
    function historyUI() { const state = history.state(); $('#timing-undo').disabled = !state.undo; $('#timing-redo').disabled = !state.redo; }
    function selectionUI() {
        const event = eventFor(), input = $('#timing-time');
        input.disabled = !event; input.setAttribute('aria-invalid', 'false');
        input.value = event ? model.format(event.timeMs) : '';
        $('#timing-selected-text').textContent = event ? event.lines.join('\n') : '選取一個歌詞事件';
        for (const button of editor.querySelectorAll('[data-timing-adjust]')) button.disabled = !event;
        $('#timing-seek-selected').disabled = !event || !Number.isFinite(duration());
        for (const [id, node] of nodes) node.setAttribute('aria-selected', String(id === selected?.id));
        historyUI();
    }
    function select(source, id) { selected = { source, id }; selectionUI(); }
    function edit(ms, snapMs = 0) {
        const event = eventFor(); if (!event) return false;
        const from = event.timeMs, selection = { ...selected }, documentId = docs[selected.source].id;
        const to = model.bounded(ms, duration(), snapMs);
        if (to === from) { selectionUI(); return false; }
        lyrics.retime(selection.source, selection.id, to);
        history.record({ ...selection, documentId, from, to }); selectionUI(); message('已更新 Raw 時間：' + model.format(to)); return true;
    }
    function adjust(delta) { const event = eventFor(); if (event) edit(event.timeMs + delta); }
    function undo() { if (history.undo()) { historyUI(); message('已復原校時。'); } }
    function redo() { if (history.redo()) { historyUI(); message('已重做校時。'); } }
    function layout() {
        const last = Math.max(0, ...Object.values(docs).flatMap(doc => doc?.events.map(event => event.timeMs / 1000) || []));
        extent = Math.max(Number.isFinite(duration()) ? duration() : 30, last + 2);
        scale = Math.min(scale, 8000000 / Math.max(1, extent)); map = model.mapping(scale);
        content.style.width = Math.max(width, map.timeToX(extent)) + 'px';
        for (const doc of Object.values(docs)) for (const [index, event] of (doc?.events || []).entries()) {
            const node = nodes.get(event.id); if (!node) continue;
            const next = doc.events[index + 1], space = next ? Math.max(24, xTime(next) - xTime(event) - 4) : 230;
            node.style.left = xTime(event) + 'px'; node.style.width = Math.min(space, 230, Math.max(90, event.rawText.length * 7 + 38)) + 'px';
            node.querySelector('small').textContent = model.format(event.timeMs);
        }
        draw();
        updatePlayback();
    }
    function blocks() {
        const focusedId = document.activeElement?.closest('.timing-block')?.dataset.id;
        nodes.clear(); lastActive = { primary: null, secondary: null };
        for (const source of ['primary', 'secondary']) {
            const track = $('#timing-' + source); track.replaceChildren();
            for (const event of docs[source]?.events || []) {
                const node = document.createElement('button'); node.type = 'button'; node.className = 'timing-block';
                node.dataset.id = event.id; node.dataset.source = source; node.dataset.type = event.type;
                node.setAttribute('aria-label', source + ' ' + model.format(event.timeMs) + ' ' + event.lines.join(' / '));
                node.title = event.lines.join('\n');
                const timestamp = document.createElement('small'), text = document.createElement('span');
                text.textContent = event.type === 'interlude' ? '••• 間奏' : event.rawText || '（空白 cue）';
                node.append(timestamp, text); track.append(node); nodes.set(event.id, node);
                node.addEventListener('click', () => select(source, event.id));
                node.addEventListener('dblclick', () => { select(source, event.id); seekSelected(); });
            }
            $('#timing-export-' + source).disabled = !docs[source];
        }
        if (!eventFor()) selected = null;
        selectionUI(); layout();
        if (focusedId) nodes.get(focusedId)?.focus({ preventScroll: true });
    }
    if (window.WaveCanvasPerf) {
        draw = window.WaveCanvasPerf.wrap('timing.draw', draw);
        layout = window.WaveCanvasPerf.wrap('timing.layout', layout);
        blocks = window.WaveCanvasPerf.wrap('timing.blocks', blocks);
        updatePlayback = window.WaveCanvasPerf.wrap('timing.playhead+markers', updatePlayback);
    }
    lyrics.subscribe((state) => {
        if (state.documentRevision !== revision) {
            const oldIds = [docs.primary?.id, docs.secondary?.id];
            docs.primary = lyrics.getDocument('primary'); docs.secondary = lyrics.getDocument('secondary');
            if (oldIds[0] !== docs.primary?.id || oldIds[1] !== docs.secondary?.id) {
                history.clear(); drag = null; selected = null;
                for (const [source, url] of downloads) { URL.revokeObjectURL(url); $('#timing-download-' + source).hidden = true; }
                downloads.clear();
            }
            revision = state.documentRevision; blocks(); offsetUI();
        }
        updatePlayback();
    });
    runtime.subscribe((_, standalone) => {
        settings = standalone.lyrics;
        offsetUI();
        updatePlayback();
    });
    function tickInterval() { const target = 75 / scale; return [0.01,0.05,0.1,0.25,0.5,1,2,5,10,15,30,60,120,300,600,1800,3600,7200,18000,36000].find(value => value >= target) || 60000; }
    function rulerLabel(seconds, interval) {
        const total = Math.floor(seconds), hours = Math.floor(total / 3600), minutes = Math.floor(total / 60) % 60;
        const result = (hours ? String(hours).padStart(2, '0') + ':' : '') + String(hours ? minutes : Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
        return interval < 1 ? result + '.' + String(Math.round((seconds % 1) * 1000)).padStart(3, '0') : result;
    }
    function draw() {
        if (!visible() || width < 1) return;
        const ratio = Math.min(2, window.devicePixelRatio || 1), height = 72;
        if (canvas.width !== Math.round(width * ratio) || canvas.height !== height * ratio) { canvas.width = Math.round(width * ratio); canvas.height = height * ratio; }
        canvas.style.width = width + 'px'; canvas.style.left = scroll.scrollLeft + 'px';
        const ctx = canvas.getContext('2d'); ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#222934'; ctx.fillRect(0, 0, width, 24); ctx.font = '10px system-ui';
        const interval = tickInterval(), start = map.xToTime(scroll.scrollLeft), end = map.xToTime(scroll.scrollLeft + width);
        for (let second = Math.ceil(start / interval) * interval; second <= end; second += interval) {
            const x = map.timeToX(second) - scroll.scrollLeft;
            ctx.strokeStyle = '#465264'; ctx.beginPath(); ctx.moveTo(x, 16); ctx.lineTo(x, 24); ctx.stroke();
            ctx.fillStyle = '#a0adc0'; ctx.fillText(rulerLabel(second, interval), x + 4, 12);
        }
        ctx.strokeStyle = '#3b4554'; ctx.beginPath(); ctx.moveTo(0, 48); ctx.lineTo(width, 48); ctx.stroke();
        if (!peaks) { ctx.fillStyle = '#7d8ba0'; ctx.fillText(waveState, 12, 55); return; }
        const level = waveform.level(peaks, 1 / scale); ctx.strokeStyle = '#829bbb'; ctx.beginPath();
        for (let x = 0; x < width; x++) {
            const first = Math.floor(map.xToTime(scroll.scrollLeft + x) * peaks.sampleRate / level.stride);
            const last = Math.min(level.min.length - 1, Math.ceil(map.xToTime(scroll.scrollLeft + x + 1) * peaks.sampleRate / level.stride));
            if (first >= level.min.length) continue;
            let low = 0, high = 0;
            for (let i = Math.max(0, first); i <= last; i++) { low = Math.min(low, level.min[i]); high = Math.max(high, level.max[i]); }
            ctx.moveTo(x + .5, 48 - high * 20); ctx.lineTo(x + .5, 48 - low * 20);
        }
        ctx.stroke();
    }
    function updatePlayback() {
        const profile = window.WaveCanvasPerf, start = profile ? performance.now() : 0;
        head.style.left = map.timeToX(Number.isFinite(audio.currentTime) ? audio.currentTime : 0) + 'px';
        head.setAttribute('aria-valuenow', String(audio.currentTime || 0)); head.setAttribute('aria-valuemax', String(Number.isFinite(duration()) ? duration() : 0));
        const markersStart = profile ? performance.now() : 0;
        profile?.record('timing.playhead', markersStart - start);
        for (const source of ['primary', 'secondary']) {
            const index = window.VisualizerLRC.activeIndex(docs[source]?.events || [], audio.currentTime * 1000 + offsets(source));
            const id = docs[source]?.events[index]?.id || null;
            if (lastActive[source] !== id) { if (lastActive[source]) nodes.get(lastActive[source])?.removeAttribute('data-active'); if (id) nodes.get(id)?.setAttribute('data-active', 'true'); lastActive[source] = id; }
        }
        profile?.record('timing.markers', performance.now() - markersStart);
    }
    function runFrame() {
        frame = null;
        if (!visible() || audio.paused || audio.ended) return;
        updatePlayback();
        const followStart = window.WaveCanvasPerf ? performance.now() : 0;
        if ($('#timing-follow').checked && Date.now() > manualUntil && !drag) {
            const x = map.timeToX(audio.currentTime), relative = x - scroll.scrollLeft;
            if (relative > width * .8 || relative < 0) scroll.scrollLeft = Math.max(0, x - width * .25);
        }
        window.WaveCanvasPerf?.record('timing.follow', performance.now() - followStart);
        frame = window.requestAnimationFrame(runFrame);
    }
    function frames() { if (frame !== null) window.cancelAnimationFrame(frame); frame = null; if (visible() && !audio.paused && !audio.ended) frame = window.requestAnimationFrame(runFrame); }
    function resize() { width = Math.max(1, scroll.clientWidth); layout(); frames(); }
    new ResizeObserver(resize).observe(scroll);
    panel.addEventListener('toggle', () => { resize(); window.dispatchEvent(new Event('resize')); });
    window.addEventListener('wavecanvas-view-change', () => { resize(); });
    scroll.addEventListener('scroll', draw);
    for (const event of ['loadedmetadata','durationchange','play','pause','ended','seeking','seeked','timeupdate','emptied']) audio.addEventListener(event, () => {
        if (['loadedmetadata','durationchange','emptied'].includes(event)) { layout(); selectionUI(); }
        updatePlayback(); frames();
    });
    function zoom(next, anchorX = width / 2) {
        const old = scale; scale = Math.max(.0001, Math.min(1200, 8000000 / Math.max(extent, 1), next));
        const nextScroll = model.zoomScroll(old, scale, scroll.scrollLeft, anchorX); map = model.mapping(scale);
        layout(); scroll.scrollLeft = Math.max(0, nextScroll); draw();
    }
    function fitSong() { zoom(Math.max(.0001, width / extent)); scroll.scrollLeft = 0; draw(); }
    $('#timing-zoom-in').addEventListener('click', () => zoom(scale * 1.5)); $('#timing-zoom-out').addEventListener('click', () => zoom(scale / 1.5)); $('#timing-fit').addEventListener('click', fitSong);
    scroll.addEventListener('wheel', event => {
        if (editableTarget(event.target)) return;
        manualUntil = Date.now() + 3000;
        if (event.ctrlKey) { event.preventDefault(); zoom(scale * Math.exp(-Math.max(-120, Math.min(120, event.deltaY)) * .003), event.clientX - scroll.getBoundingClientRect().left); }
        else if (event.altKey) { event.preventDefault(); scroll.scrollLeft += Math.sign(event.deltaY || event.deltaX) * Math.min(120, Math.max(30, scale * .75)); }
    }, { passive: false });
    document.addEventListener('wheel', event => { if (event.ctrlKey && !scroll.contains(event.target) && !editableTarget(event.target)) event.preventDefault(); }, { passive: false });
    function pointTime(event) { return map.xToTime(event.clientX - scroll.getBoundingClientRect().left + scroll.scrollLeft); }
    scroll.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        const block = event.target.closest('.timing-block');
        if (block) {
            select(block.dataset.source, block.dataset.id);
            block.focus({ preventScroll: true });
            drag = { kind: 'lyric', id: selected.id, source: selected.source, from: eventFor().timeMs, start: pointTime(event), next: eventFor().timeMs, moved: false };
        } else if (event.target.closest('#timing-waveform,#timing-playhead')) { (event.target.closest('#timing-playhead') || scroll).focus({ preventScroll: true }); drag = { kind: 'head' }; seek(pointTime(event)); }
        else { manualUntil = Date.now() + 3000; return; }
        event.preventDefault(); manualUntil = Date.now() + 3000;
        if (event.isTrusted) scroll.setPointerCapture(event.pointerId);
    });
    document.addEventListener('pointermove', event => {
        if (!drag) return; event.preventDefault();
        if (drag.kind === 'head') { seek(pointTime(event)); return; }
        drag.moved = true;
        drag.next = model.bounded(drag.from + (pointTime(event) - drag.start) * 1000, duration(), Number($('#timing-snap').value));
        const node = nodes.get(drag.id); if (!node) return;
        node.style.left = map.timeToX(drag.next / 1000) + 'px'; node.querySelector('small').textContent = model.format(drag.next);
        $('#timing-time').value = model.format(drag.next);
    });
    document.addEventListener('pointerup', event => {
        if (!drag) return;
        const completed = drag; drag = null;
        if (scroll.hasPointerCapture?.(event.pointerId)) scroll.releasePointerCapture(event.pointerId);
        if (completed.kind === 'lyric' && completed.moved) { selected = { source: completed.source, id: completed.id }; edit(completed.next); }
    });
    function cancelDrag() { if (drag) { drag = null; layout(); selectionUI(); } }
    document.addEventListener('pointercancel', cancelDrag);
    for (const button of editor.querySelectorAll('[data-timing-adjust]')) button.addEventListener('click', () => adjust(Number(button.dataset.timingAdjust)));
    $('#timing-seek-selected').addEventListener('click', seekSelected);
    const timeInput = $('#timing-time');
    function manualTime() {
        try { edit(model.parseTime(timeInput.value)); timeInput.setAttribute('aria-invalid', 'false'); }
        catch (error) { timeInput.setAttribute('aria-invalid', 'true'); message(error.message, true); }
    }
    timeInput.addEventListener('change', manualTime); timeInput.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); manualTime(); } });
    $('#timing-undo').addEventListener('click', undo); $('#timing-redo').addEventListener('click', redo);
    editor.addEventListener('keydown', event => {
        if (editableTarget(event.target)) return;
        if (event.key === 'Escape') { cancelDrag(); return; }
        if ((event.ctrlKey || event.metaKey) && ['z','y'].includes(event.key.toLowerCase())) {
            event.preventDefault(); if (event.key.toLowerCase() === 'y' || event.shiftKey) redo(); else undo();
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault(); const delta = (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 100 : 10);
            if (event.target === head) seek(audio.currentTime + delta / 1000); else adjust(delta);
        }
    });
    function exportLRC(source) {
        const doc = docs[source]; if (!doc) return;
        if (downloads.has(source)) URL.revokeObjectURL(downloads.get(source));
        const url = URL.createObjectURL(new Blob([model.serialize(doc)], { type: 'text/plain;charset=utf-8' })); downloads.set(source, url);
        const link = $('#timing-download-' + source); link.href = url; link.download = (doc.name || source + '.lrc').replace(/\.lrc$/i, '').replace(/[\\/:*?"<>|]/g, '_') + '-timed.lrc'; link.hidden = false; link.click();
        message('已建立 UTF-8 LRC；若下載未啟動，可使用下載連結。');
    }
    for (const source of ['primary','secondary']) $('#timing-export-' + source).addEventListener('click', () => exportLRC(source));
    async function loadWaveform() {
        const version = ++waveVersion, file = window.VisualizerLocalAudio.getFile(); peaks = null;
        waveState = file ? 'Waveform 解碼中…' : '尚未載入音訊，仍可校時 LRC。'; message(waveState); draw();
        if (!file) return;
        try {
            if (file.size > 512 * 1024 * 1024) throw new Error('音訊超過 512 MB，略過 waveform；仍可播放與校時。');
            const Context = window.OfflineAudioContext || window.webkitOfflineAudioContext;
            if (!Context) throw new Error('此環境沒有獨立 waveform 解碼能力。');
            const bytes = await file.arrayBuffer(); if (version !== waveVersion) return;
            const context = new Context(1, 1, 44100), buffer = await context.decodeAudioData(bytes);
            if (version !== waveVersion) return;
            const cache = await waveform.build(buffer, () => version !== waveVersion);
            if (version !== waveVersion || !cache) return;
            peaks = cache; waveState = 'Waveform 已快取 · Ctrl+滾輪縮放 / Alt+滾輪水平捲動'; message(waveState); draw();
        } catch (error) { if (version === waveVersion) { waveState = 'Waveform 無法建立；播放與 LRC 校時仍可使用。'; message(error.message, true); draw(); } }
    }
    window.addEventListener('local-audio-change', loadWaveform);
    window.addEventListener('pagehide', event => { if (!event.persisted) { waveVersion++; if (frame !== null) window.cancelAnimationFrame(frame); for (const url of downloads.values()) URL.revokeObjectURL(url); } });
    loadWaveform(); resize();
    window.VisualizerTimingEditor = Object.freeze({ select, edit, adjust, undo, redo, zoom, fitSong, seek, exportLRC,
        getState: () => ({ scale, extent, selected: selected && { ...selected }, scrollLeft: scroll.scrollLeft, waveformReady: !!peaks, waveformLevels: peaks?.levels.length || 0, history: history.state() }) });
}());

(function () {
    'use strict';
    let serial = 0;
    const MAX_TIME = 599999999;
    function format(ms) {
        if (!Number.isFinite(ms) || ms < 0 || ms > MAX_TIME) throw new Error('時間超出 LRC 支援範圍。');
        ms = Math.round(ms);
        return String(Math.floor(ms / 60000)).padStart(2, '0') + ':' + String(Math.floor(ms / 1000) % 60).padStart(2, '0') + '.' + String(ms % 1000).padStart(3, '0');
    }
    function parseTime(value) {
        const match = /^(\d{1,4}):([0-5]\d)\.(\d{3})$/.exec(value.trim());
        if (!match) throw new Error('請輸入 mm:ss.xxx，例如 01:24.530。');
        const ms = Number(match[1]) * 60000 + Number(match[2]) * 1000 + Number(match[3]);
        if (ms > MAX_TIME) throw new Error('時間超出 LRC 支援範圍。');
        return ms;
    }
    function bounded(ms, duration = Infinity, snapMs = 0) {
        if (!Number.isFinite(ms)) throw new Error('時間必須是有限數值。');
        if (!Number.isFinite(snapMs) || snapMs < 0) throw new Error('Snap 必須是非負有限數值。');
        const limit = Number.isFinite(duration) ? Math.min(MAX_TIME, Math.max(0, Math.floor(duration * 1000))) : MAX_TIME;
        const snapped = snapMs ? Math.round(ms / snapMs) * snapMs : Math.round(ms);
        return Math.max(0, Math.min(limit, snapped));
    }
    function fromText(text, source, name = '') {
        const parsed = window.VisualizerLyricsImport ? window.VisualizerLyricsImport.parse(text, name) : window.VisualizerLRC.parse(text);
        const id = source + '-' + (++serial);
        if (parsed.sourceFormat === 'srt') {
            return { id, source, name, sourceFormat: 'srt', fileOffsetMs: 0, metadata: [], sourceWarnings: parsed.warnings.map(warning => ({ ...warning })),
                events: parsed.cues.map(cue => ({ id: source + '-srt:' + cue.order, source, timeMs: cue.startTimeMs,
                    lines: [cue.text], rawText: cue.text, type: cue.text === '...' ? 'interlude' : 'lyric',
                    sourceCue: { sourceFormat: 'srt', sequence: cue.sequence, sequenceRaw: cue.sequenceRaw, order: cue.order,
                        startTimeMs: cue.startTimeMs, endTimeMs: cue.endTimeMs, rawLines: cue.rawLines.slice() } })) };
        }
        const groups = new Map();
        for (const row of parsed.sourceRows) {
            if (!groups.has(row.timeMs)) groups.set(row.timeMs, []);
            groups.get(row.timeMs).push(row.rawText ?? row.text);
        }
        return { id, source, name, sourceFormat: 'lrc', fileOffsetMs: parsed.fileOffsetMs, metadata: parsed.metadata.slice(),
            events: Array.from(groups, ([timeMs, lines], index) => ({ id: id + ':' + index, source, timeMs, lines: lines.slice(),
                rawText: (lines.find(line => line.trim() !== '') || '').trim(), type: (lines.find(line => line.trim() !== '') || '').trim() === '...' ? 'interlude' : 'lyric' })) };
    }
    function snapshot(doc) {
        return doc ? { ...doc, metadata: doc.metadata.slice(),
            ...(doc.sourceWarnings ? { sourceWarnings: doc.sourceWarnings.map(warning => ({ ...warning })) } : {}),
            events: doc.events.map(event => ({ ...event, lines: event.lines.slice(),
                ...(event.sourceCue ? { sourceCue: { ...event.sourceCue, rawLines: event.sourceCue.rawLines.slice() } } : {}) })) } : null;
    }
    function reserveId(doc) {
        const match = /^(?:primary|secondary)-(\d{1,12})$/.exec(doc?.id || '');
        if (match) serial = Math.max(serial, Number(match[1]));
    }
    function retime(doc, id, ms, duration = Infinity, snapMs = 0) {
        const event = doc?.events.find(event => event.id === id);
        if (!event) throw new Error('歌詞事件已不存在。');
        event.timeMs = bounded(ms, duration, snapMs);
        doc.events.sort((a, b) => a.timeMs - b.timeMs || a.id.localeCompare(b.id, 'en', { numeric: true }));
        return event.timeMs;
    }
    function toParsed(doc) {
        if (!doc) return { events: [], fileOffsetMs: 0, warnings: [] };
        const groups = new Map(), warnings = (doc.sourceWarnings || []).map(warning => ({ ...warning })), events = [];
        for (const event of doc.events) {
            if (!groups.has(event.timeMs)) groups.set(event.timeMs, []);
            groups.get(event.timeMs).push(...event.lines.map(line => line.trim()).filter(line => line !== ''));
        }
        for (const [timeMs, lines] of groups) {
            events.push(Object.freeze({ timeMs, primary: lines[0] || '', secondary: lines[1] || '' }));
            if (lines.length > 2) warnings.push({ timeMs, message: '同時間超過兩行，已忽略額外內容。' });
        }
        return { events, warnings, fileOffsetMs: doc.fileOffsetMs };
    }
    function serialize(doc) {
        if (!doc) return '';
        const lines = doc.metadata.slice();
        if (doc.fileOffsetMs || doc.metadata.some(line => /^\[offset:/i.test(line))) {
            const withoutOffset = lines.filter(line => !/^\[offset:/i.test(line));
            lines.splice(0, lines.length, ...withoutOffset, '[offset:' + doc.fileOffsetMs + ']');
        }
        for (const event of doc.events) for (const text of event.lines) lines.push('[' + format(event.timeMs) + ']' + text);
        return lines.join('\r\n') + (lines.length ? '\r\n' : '');
    }
    function mapping(scale) {
        if (!Number.isFinite(scale) || scale <= 0) throw new Error('Timeline scale 必須大於零。');
        return Object.freeze({ timeToX: seconds => seconds * scale, xToTime: x => x / scale });
    }
    function zoomScroll(oldScale, newScale, scroll, anchorX) { return (scroll + anchorX) / oldScale * newScale - anchorX; }
    function history(apply, limit = 200) {
        let past = [], future = [];
        return Object.freeze({
            record(edit) { if (edit.from === edit.to) return; past.push({ ...edit }); if (past.length > limit) past.shift(); future = []; },
            undo() { const edit = past.pop(); if (!edit) return false; apply(edit, edit.from); future.push(edit); return true; },
            redo() { const edit = future.pop(); if (!edit) return false; apply(edit, edit.to); past.push(edit); return true; },
            clear() { past = []; future = []; }, state: () => ({ undo: past.length, redo: future.length })
        });
    }
    window.VisualizerTimingModel = Object.freeze({ format, parseTime, bounded, fromText, reserveId, snapshot, retime, toParsed, serialize, mapping, zoomScroll, history });
}());

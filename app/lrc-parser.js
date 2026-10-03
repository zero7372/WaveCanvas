(function () {
    'use strict';
    function parse(text) {
        if (typeof text !== 'string' || text.length > 1024 * 1024) throw new Error('LRC 必須小於 1 MB。');
        const raw = [], events = [], warnings = [], metadata = [];
        let fileOffsetMs = 0;
        for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
            const trimmed = line.trim();
            if (/^\[[a-z][a-z0-9]*:[^\]\r\n]*\]$/i.test(trimmed)) metadata.push(trimmed);
            const offset = /^\[offset:([+-]?\d+)\]$/i.exec(trimmed);
            if (offset) {
                const value = Number(offset[1]);
                if (Number.isSafeInteger(value) && Math.abs(value) <= 86400000) fileOffsetMs = value;
                continue;
            }
            const matched = /^((?:\[\d{1,4}:\d{2}(?:\.\d{1,3})?\])+)(.*)$/.exec(trimmed);
            if (!matched || /<\d+:\d{2}(?:\.\d+)?>/.test(matched[2])) continue;
            const lyric = matched[2].trim();
            const sourceText = /^((?:\[\d{1,4}:\d{2}(?:\.\d{1,3})?\])+)(.*)$/.exec(line.trimStart())[2];
            for (const timestamp of matched[1].matchAll(/\[(\d+):(\d{2})(?:\.(\d{1,3}))?\]/g)) {
                if (Number(timestamp[2]) >= 60) continue;
                const timeMs = Number(timestamp[1]) * 60000 + Number(timestamp[2]) * 1000
                    + Number((timestamp[3] || '').padEnd(3, '0'));
                if (raw.length >= 10000) throw new Error('LRC 最多支援 10,000 個逐行事件。');
                raw.push({ timeMs, text: lyric, rawText: sourceText });
            }
        }
        raw.sort((a, b) => a.timeMs - b.timeMs);
        for (let start = 0; start < raw.length;) {
            let end = start + 1;
            while (end < raw.length && raw[end].timeMs === raw[start].timeMs) end++;
            const lines = raw.slice(start, end).filter(event => event.text !== '');
            events.push(Object.freeze({ timeMs: raw[start].timeMs, primary: lines[0]?.text || '', secondary: lines[1]?.text || '' }));
            if (lines.length > 2) warnings.push({ timeMs: raw[start].timeMs, message: '同時間超過兩行，已忽略額外內容。' });
            start = end;
        }
        return { events, fileOffsetMs, warnings, sourceRows: raw.map(row => ({ ...row })), metadata };
    }
    function merge(primary, secondary, options = {}) {
        if (!secondary) return primary.events;
        const tolerance = options.mergeToleranceMs ?? 100;
        const offset = options.secondaryOffsetMs ?? 0;
        const matches = new Map(), used = new Set();
        const byTime = new Map(secondary.events.map((event, index) => [event.timeMs, index]));
        const target = event => event.timeMs - primary.fileOffsetMs + secondary.fileOffsetMs + offset;
        // Reserve exact matches before any tolerance match can consume their secondary cue.
        primary.events.forEach((event, index) => {
            const candidate = byTime.get(target(event));
            if (candidate !== undefined && !used.has(candidate)) { matches.set(index, candidate); used.add(candidate); }
        });
        primary.events.forEach((event, index) => {
            if (matches.has(index)) return;
            const time = target(event);
            let low = 0, high = secondary.events.length;
            while (low < high) { const middle = (low + high) >>> 1; if (secondary.events[middle].timeMs < time - tolerance) low = middle + 1; else high = middle; }
            let nearest = -1, distance = Infinity;
            for (let i = low; i < secondary.events.length && secondary.events[i].timeMs <= time + tolerance; i++) {
                const delta = Math.abs(secondary.events[i].timeMs - time);
                if (!used.has(i) && delta < distance) { nearest = i; distance = delta; }
            }
            if (nearest >= 0) { matches.set(index, nearest); used.add(nearest); }
        });
        return primary.events.map((event, index) => Object.freeze({ timeMs: event.timeMs, primary: event.primary,
            secondary: matches.has(index) ? secondary.events[matches.get(index)].primary : '' }));
    }
    function activeIndex(events, timeMs) {
        let low = 0, high = events.length;
        while (low < high) {
            const middle = (low + high) >>> 1;
            if (events[middle].timeMs <= timeMs) low = middle + 1; else high = middle;
        }
        return low - 1;
    }
    window.VisualizerLRC = Object.freeze({ parse, activeIndex, merge });
}());

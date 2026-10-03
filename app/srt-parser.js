(function () {
    'use strict';
    function timestamp(value) {
        const match = /^(\d{2,}):([0-5]\d):([0-5]\d),(\d{3})$/.exec(value.trim());
        if (!match) return null;
        const ms = Number(match[1]) * 3600000 + Number(match[2]) * 60000 + Number(match[3]) * 1000 + Number(match[4]);
        return Number.isSafeInteger(ms) ? ms : null;
    }
    function plainText(value) {
        return value.replace(/<br\s*\/?\s*>/gi, ' ').replace(/<[^>]*>/g, '')
            .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (whole, entity) => {
                const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
                if (entity[0] !== '#') return named[entity.toLowerCase()];
                const number = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
                return Number.isInteger(number) && number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff) ? String.fromCodePoint(number) : '\ufffd';
            }).replace(/\s+/g, ' ').trim();
    }
    function parse(text) {
        if (typeof text !== 'string' || text.length > 1024 * 1024) throw new Error('SRT 必須小於 1 MB。');
        const lines = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
        const headers = [], cues = [], warnings = [];
        for (let index = 0; index < lines.length; index++) {
            if (lines[index].includes('-->')) {
                let sequenceIndex = index - 1;
                while (sequenceIndex >= 0 && lines[sequenceIndex].trim() === '') sequenceIndex--;
                if (sequenceIndex < 0 || !/^\s*\d+\s*$/.test(lines[sequenceIndex])) sequenceIndex = null;
                headers.push({ index, sequenceIndex });
            }
        }
        if (headers.length > 10000) throw new Error('SRT 最多支援 10,000 個字幕事件。');
        for (let order = 0; order < headers.length; order++) {
            const { index, sequenceIndex } = headers[order], next = headers[order + 1];
            const timing = /^\s*(\d+:\d{2}:\d{2},\d{3})\s*-->\s*(\d+:\d{2}:\d{2},\d{3})\s*$/.exec(lines[index]);
            const startTimeMs = timing ? timestamp(timing[1]) : null, endTimeMs = timing ? timestamp(timing[2]) : null;
            if (startTimeMs === null || endTimeMs === null || endTimeMs < startTimeMs || startTimeMs > 599999999) {
                warnings.push({ line: index + 1, code: 'invalid-timestamp', message: '已跳過無效或超出 Timing 範圍的字幕時間。' }); continue;
            }
            // A sequence immediately before the next header belongs to the next cue, not its predecessor.
            const end = next ? next.sequenceIndex ?? next.index : lines.length;
            const rawLines = lines.slice(index + 1, end);
            const value = rawLines.map(plainText).filter(Boolean).join(' ');
            if (!value) { warnings.push({ line: index + 1, code: 'empty-cue', message: '已忽略空白字幕。' }); continue; }
            const sequenceRaw = sequenceIndex === null ? null : lines[sequenceIndex].trim();
            const sequence = sequenceRaw !== null && Number.isSafeInteger(Number(sequenceRaw)) ? Number(sequenceRaw) : null;
            cues.push({ order, sequence, sequenceRaw, startTimeMs, endTimeMs, text: value, rawLines });
        }
        cues.sort((a, b) => a.startTimeMs - b.startTimeMs || a.order - b.order);
        return { sourceFormat: 'srt', cues, warnings };
    }
    window.VisualizerSRT = Object.freeze({ parse, timestamp, plainText });
}());

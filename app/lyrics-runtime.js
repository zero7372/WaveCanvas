(function () {
    'use strict';
    const isInterlude = event => event?.primary.trim() === '...';
    function interludeTiming(event, next, timeMs) {
        const durationMs = Math.max(0, (next?.timeMs ?? event.timeMs) - event.timeMs);
        const cycles = Math.max(1, Math.round(durationMs / 1800));
        const intervalMs = Math.min(900, Math.max(250, durationMs / (cycles * 3)));
        const cycleMs = intervalMs * 3;
        const elapsedMs = Math.max(0, timeMs - event.timeMs);
        return { durationMs, intervalMs, cycleMs, phase: (elapsedMs % cycleMs) / cycleMs };
    }
    function create(audio, getOffset = () => 0, getMergeSettings = () => ({})) {
        let primary = { events: [], fileOffsetMs: 0, warnings: [] }, secondary = null;
        let events = [], fileOffsetMs = 0, active = -1, name = '', secondaryName = '';
        let phase = 'PRE_LYRICS';
        const model = window.VisualizerTimingModel;
        let primaryDocument = null, secondaryDocument = null, documentRevision = 0;
        const subscribers = new Set();
        const handlers = new Map();
        function timeMs() { return (Number.isFinite(audio.currentTime) ? audio.currentTime : 0) * 1000 + fileOffsetMs + getOffset(); }
        function endTimeMs() {
            return Number.isFinite(audio.duration) ? audio.duration * 1000 + fileOffsetMs + getOffset() : Infinity;
        }
        function state() { return { activeIndex: active, phase, endTimeMs: endTimeMs(), count: events.length, fileOffsetMs, name, secondaryName, documentRevision,
            interlude: phase === 'ACTIVE' && isInterlude(events[active]) ? interludeTiming(events[active], events[active + 1], timeMs()) : null,
            sourceFormat: primaryDocument?.sourceFormat || null, secondarySourceFormat: secondaryDocument?.sourceFormat || null,
            secondaryFileOffsetMs: secondary?.fileOffsetMs || 0, warnings: primary.warnings.length + (secondary?.warnings.length || 0) }; }
        function notify(reason) { for (const callback of subscribers) callback(state(), reason); }
        function update(reason = 'play', force = false) {
            const now = timeMs();
            const next = window.VisualizerLRC.activeIndex(events, now);
            const nextPhase = !events.length || next < 0 ? 'PRE_LYRICS' : now >= endTimeMs() || audio.ended || reason === 'ended' ? 'POST_LYRICS' : 'ACTIVE';
            if (next !== active || nextPhase !== phase || force) { active = next; phase = nextPhase; notify(reason); }
            return active;
        }
        function clear(reason = 'clear') { primary = { events: [], fileOffsetMs: 0, warnings: [] }; secondary = null; primaryDocument = secondaryDocument = null; documentRevision++; events = []; fileOffsetMs = 0; active = -1; phase = 'PRE_LYRICS'; name = ''; secondaryName = ''; notify(reason); }
        function rebuild() { events = window.VisualizerLRC.merge(primary, secondary, getMergeSettings()); fileOffsetMs = primary.fileOffsetMs; update('load', true); }
        for (const event of ['play', 'pause', 'timeupdate', 'seeking', 'seeked', 'ended', 'durationchange', 'loadedmetadata']) {
            const handler = () => update(event === 'seeking' || event === 'seeked' ? 'seek' : event, event === 'seeking');
            handlers.set(event, handler); audio.addEventListener(event, handler);
        }
        const emptied = () => clear('audio-change'); handlers.set('emptied', emptied); audio.addEventListener('emptied', emptied);
        return Object.freeze({
            update, clear, getState: state, refreshMerge: rebuild,
            getEvent: index => events[index] || null,
            getDocument: source => model.snapshot(source === 'primary' ? primaryDocument : secondaryDocument),
            restoreDocuments(documents) {
                primaryDocument = model.snapshot(documents.primary);
                secondaryDocument = model.snapshot(documents.secondary);
                model.reserveId(primaryDocument); model.reserveId(secondaryDocument);
                primary = model.toParsed(primaryDocument); secondary = secondaryDocument ? model.toParsed(secondaryDocument) : null;
                name = primaryDocument?.name || ''; secondaryName = secondaryDocument?.name || '';
                documentRevision++; active = -1; rebuild();
            },
            retime(source, id, ms, snapMs = 0) {
                if (!['primary', 'secondary'].includes(source)) throw new Error('未知的歌詞軌道。');
                const doc = source === 'primary' ? primaryDocument : secondaryDocument;
                const value = model.retime(doc, id, ms, audio.duration, snapMs);
                primary = model.toParsed(primaryDocument); secondary = secondaryDocument ? model.toParsed(secondaryDocument) : null;
                documentRevision++; rebuild(); return value;
            },
            load(text, fileName = '') {
                const doc = model.fromText(text, 'primary', fileName);
                primaryDocument = doc; primary = model.toParsed(doc); documentRevision++; active = -1; name = fileName;
                rebuild(); return state();
            },
            loadSecondary(text, fileName = '') { const doc = model.fromText(text, 'secondary', fileName); secondaryDocument = doc; secondary = model.toParsed(doc); documentRevision++; secondaryName = fileName; rebuild(); return state(); },
            clearSecondary() { secondary = null; secondaryDocument = null; documentRevision++; secondaryName = ''; rebuild(); },
            subscribe(callback) { subscribers.add(callback); callback(state(), 'initial'); return () => subscribers.delete(callback); },
            destroy() { for (const [event, handler] of handlers) audio.removeEventListener(event, handler); subscribers.clear(); }
        });
    }
    function envelope(current, target, dtMs, attackMs, releaseMs) {
        const bounded = Math.max(0, Math.min(1, target));
        const tau = bounded > current ? attackMs : releaseMs;
        return current + (bounded - current) * (1 - Math.exp(-Math.max(0, dtMs) / Math.max(1, tau)));
    }
    window.VisualizerLyricsRuntime = Object.freeze({ create, envelope, isInterlude, interludeTiming });
}());

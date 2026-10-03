(function () {
    'use strict';
    const runtime = window.VisualizerRuntime;
    if (runtime.mode !== 'standalone') return;
    const layer = document.querySelector('#lyrics-layer');
    const stack = document.querySelector('#lyrics-stack');
    const audio = document.querySelector('#local-audio');
    let settings = runtime.getStandalone().lyrics;
    let signature = '', active = -1, frame = null, lastTime = 0, bassEnvelope = 0;
    let phase = 'PRE_LYRICS', exitAnimation = null;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pool = [];
    const controller = window.VisualizerLyricsRuntime.create(audio, () => settings.globalOffsetMs, () => settings);
    for (let i = 0; i < 5; i++) {
        const node = document.createElement('div'); node.className = 'lyric-line'; node.hidden = true;
        const content = document.createElement('div'); content.className = 'lyric-content';
        const primary = document.createElement('div'); primary.className = 'lyric-primary';
        const glow = document.createElement('span'); glow.className = 'lyric-glow'; glow.setAttribute('aria-hidden', 'true');
        const text = document.createElement('span'); text.className = 'lyric-text';
        const secondary = document.createElement('span'); secondary.className = 'lyric-secondary'; secondary.hidden = true;
        const dots = document.createElement('span'); dots.className = 'interlude-dots'; dots.hidden = true;
        dots.setAttribute('aria-label', '間奏');
        const dotNodes = Array.from({ length: 3 }, () => { const dot = document.createElement('span'); dot.className = 'interlude-dot'; dot.textContent = '.'; dot.setAttribute('aria-hidden', 'true'); dots.append(dot); return dot; });
        primary.append(glow, text, dots); content.append(primary, secondary); node.append(content); stack.append(node);
        pool.push({ node, glow, text, secondary, dots, dotNodes, interlude: false, eventIndex: null, animation: null });
    }
    function cancel(item) { if (item.animation) { item.animation.cancel(); item.animation = null; } }
    function resetDots(item) {
        for (const dot of item.dotNodes) { dot.style.transform = 'none'; dot.style.opacity = '0.65'; }
    }
    function cancelExit() {
        if (exitAnimation) { exitAnimation.onfinish = null; exitAnimation.cancel(); exitAnimation = null; }
        stack.style.transform = ''; stack.style.opacity = '';
    }
    function hide() {
        layer.hidden = true;
        for (const item of pool) { cancel(item); resetDots(item); item.node.hidden = true; }
    }
    function exit(reason, previousPhase) {
        const immediate = previousPhase !== 'ACTIVE' || ['seek', 'load', 'clear', 'audio-change', 'settings', 'initial'].includes(reason) || reducedMotion.matches;
        for (const item of pool) {
            if (!item.node.hidden && item.animation) {
                const style = getComputedStyle(item.node);
                const snapshot = { transform: style.transform, opacity: style.opacity, filter: style.filter };
                cancel(item); Object.assign(item.node.style, snapshot);
            } else cancel(item);
            resetDots(item);
        }
        if (immediate || layer.hidden || !settings.transitionDuration || !stack.animate) { hide(); return; }
        // Continue one focus step upwards as a single stack, without recentering the last item.
        const current = pool.find(item => item.node.dataset.focus === 'current' && !item.node.hidden);
        const step = (current?.node.offsetHeight || settings.fontSize * 1.18) * 0.86 + settings.lineSpacing;
        const animation = stack.animate([
            { transform: 'translateY(0px)', opacity: 1 },
            { transform: 'translateY(' + (-step - settings.transitionOvershoot) + 'px)', opacity: 0.08, offset: 0.86 },
            { transform: 'translateY(' + -step + 'px)', opacity: 0 }
        ], { duration: settings.transitionDuration, easing: 'cubic-bezier(.22,.68,.2,1)', fill: 'forwards' });
        exitAnimation = animation;
        animation.onfinish = () => { if (exitAnimation === animation && phase === 'POST_LYRICS') { hide(); cancelExit(); } };
    }
    function render(state, reason) {
        const previousPhase = phase;
        phase = state.phase; layer.dataset.phase = phase;
        if (phase === 'POST_LYRICS' && exitAnimation && !['seek', 'load', 'clear', 'audio-change', 'settings'].includes(reason)) return;
        cancelExit();
        const overshootDirection = state.activeIndex < active ? 1 : -1;
        active = state.activeIndex;
        if (['load', 'clear', 'audio-change'].includes(reason)) {
            bassEnvelope = 0; lastTime = 0;
            for (const item of pool) { cancel(item); item.eventIndex = null; item.node.hidden = true; }
        }
        if (!settings.enabled || phase === 'PRE_LYRICS') { hide(); return; }
        if (phase === 'POST_LYRICS') { exit(reason, previousPhase); return; }
        layer.hidden = false;
        const slots = [];
        const used = new Set();
        for (let offset = -2; offset <= 2; offset++) {
            const eventIndex = active + offset;
            const event = controller.getEvent(eventIndex);
            if (!event) continue;
            const existing = pool.find(item => item.eventIndex === eventIndex);
            if (existing) { used.add(existing); slots.push({ offset, event, eventIndex, item: existing, fresh: existing.node.hidden }); }
            else slots.push({ offset, event, eventIndex, item: null, fresh: true });
        }
        for (const slot of slots) {
            if (!slot.item) { slot.item = pool.find(item => !used.has(item)); used.add(slot.item); }
        }
        for (const item of pool) if (!used.has(item)) { cancel(item); item.node.hidden = true; item.eventIndex = null; }
        const snapshots = new Map();
        for (const slot of slots) {
            const item = slot.item;
            if (!slot.fresh) {
                const style = getComputedStyle(item.node);
                snapshots.set(item, { transform: style.transform, opacity: style.opacity, filter: style.filter });
            }
            cancel(item);
            item.node.hidden = false;
            item.interlude = window.VisualizerLyricsRuntime.isInterlude(slot.event);
            item.node.dataset.interlude = String(item.interlude);
            item.text.hidden = item.interlude; item.glow.hidden = item.interlude; item.dots.hidden = !item.interlude;
            resetDots(item);
            if (item.eventIndex !== slot.eventIndex) {
                item.text.textContent = slot.event.primary; item.glow.textContent = slot.event.primary;
                item.secondary.textContent = slot.event.secondary;
            }
            item.secondary.hidden = item.interlude || !settings.secondaryEnabled || !slot.event.secondary;
            item.eventIndex = slot.eventIndex;
            item.node.dataset.eventIndex = slot.eventIndex;
            item.node.dataset.focus = slot.offset === 0 ? 'current' : 'inactive';
            item.node.style.transformOrigin = 'top ' + (settings.textAlign === 'left' ? 'left' : settings.textAlign === 'right' ? 'right' : 'center');
        }
        // Measure only on index/settings changes. No per-frame layout reads or DOM rebuilding.
        const heights = new Map(slots.map(slot => [slot.offset, slot.item.node.offsetHeight || settings.fontSize * 1.18]));
        const half = (heights.get(0) || settings.fontSize * 1.18) / 2;
        const previousHeight = settings.showPrevious ? (heights.get(-1) || 0) * 0.86 + (heights.has(-1) ? settings.lineSpacing : 0) : 0;
        const nextHeight = settings.showNext ? (heights.get(1) || 0) * 0.86 + (heights.has(1) ? settings.lineSpacing : 0) : 0;
        const minimumY = 64 + half + previousHeight;
        const maximumY = 1016 - half - nextHeight;
        stack.style.top = Math.min(maximumY, Math.max(minimumY, settings.positionY * 10.8)) + 'px';
        const duration = ['seek', 'load', 'clear', 'audio-change', 'settings', 'initial'].includes(reason) || reducedMotion.matches ? 0 : settings.transitionDuration;
        for (const slot of slots) {
            const { item, offset } = slot;
            const visible = offset === 0 || offset === -1 && settings.showPrevious || offset === 1 && settings.showNext;
            let y = -half;
            if (offset < 0) for (let i = -1; i >= offset; i--) y -= (heights.get(i) || settings.fontSize * 1.18) * 0.86 + settings.lineSpacing;
            if (offset > 0) { y = half + settings.lineSpacing; for (let i = 1; i < offset; i++) y += (heights.get(i) || settings.fontSize * 1.18) * 0.86 + settings.lineSpacing; }
            const scale = offset === 0 ? 1 : 0.86;
            const transform = 'translateY(' + y + 'px) scale(' + scale + ')';
            const opacity = visible ? offset === 0 ? 1 : settings.inactiveOpacity : 0;
            const filter = offset === 0 ? 'blur(0px)' : 'blur(' + settings.inactiveBlur + 'px)';
            const start = snapshots.get(item) || { transform: 'translateY(' + (y + 20) + 'px) scale(' + scale + ')', opacity: 0, filter };
            item.node.style.transform = transform; item.node.style.opacity = opacity; item.node.style.filter = filter;
            item.node.setAttribute('aria-hidden', String(!visible));
            if (duration > 0 && item.node.animate) {
                const overshoot = settings.transitionOvershoot * overshootDirection;
                item.animation = item.node.animate([
                    { ...start, offset: 0 },
                    { transform: 'translateY(' + (y + overshoot) + 'px) scale(' + scale + ')', opacity, filter, offset: 0.86 },
                    { transform, opacity, filter, offset: 1 }
                ], { duration, easing: 'cubic-bezier(.22,.68,.2,1)' });
            }
        }
    }
    function configure(next) {
        settings = next;
        const width = Math.min(1792, settings.maxWidth);
        const alignment = settings.textAlign === 'left' ? 0 : settings.textAlign === 'right' ? width : width / 2;
        stack.style.left = Math.min(1856 - width, Math.max(64, settings.positionX * 19.2 - alignment)) + 'px';
        stack.style.width = width + 'px'; stack.style.textAlign = settings.textAlign;
        stack.style.setProperty('--lyric-dot-align', settings.textAlign === 'left' ? 'flex-start' : settings.textAlign === 'right' ? 'flex-end' : 'center');
        stack.style.fontFamily = window.VisualizerLyricsSettings.fontStack(settings.fontFamily);
        stack.style.fontSize = settings.fontSize + 'px';
        const contextLines = Number(settings.showPrevious) + Number(settings.showNext);
        const blockFactor = settings.secondaryEnabled ? 1 + settings.secondaryFontSizeRatio : 1;
        const blockGap = settings.secondaryEnabled ? settings.secondaryGap * (1 + contextLines * 0.86) : 0;
        const wrapLines = Math.max(1, Math.min(3, Math.floor((952 - contextLines * settings.lineSpacing - blockGap) / (settings.fontSize * 1.18 * blockFactor * (1 + contextLines * 0.86)))));
        stack.style.setProperty('--lyric-wrap-lines', wrapLines);
        stack.style.setProperty('--lyric-weight', settings.fontWeight);
        stack.style.setProperty('--lyric-current-color', settings.currentColor);
        stack.style.setProperty('--lyric-inactive-color', settings.inactiveColor);
        stack.style.setProperty('--lyric-glow-color', settings.glowColorMode === 'text' ? settings.currentColor : settings.glowColor);
        stack.style.setProperty('--lyric-secondary-font', window.VisualizerLyricsSettings.fontStack(settings.secondaryFontFamily));
        stack.style.setProperty('--lyric-secondary-size', settings.fontSize * settings.secondaryFontSizeRatio + 'px');
        stack.style.setProperty('--lyric-secondary-weight', settings.secondaryFontWeight);
        stack.style.setProperty('--lyric-secondary-color', settings.secondaryColor);
        stack.style.setProperty('--lyric-secondary-opacity', settings.secondaryOpacity);
        stack.style.setProperty('--lyric-secondary-gap', settings.secondaryGap + 'px');
        stack.style.setProperty('--lyric-secondary-order', settings.secondaryPosition === 'above' ? -1 : 1);
    }
    controller.subscribe(render);
    runtime.subscribe((_, standalone) => {
        const nextSignature = JSON.stringify(standalone.lyrics);
        if (nextSignature === signature) return;
        const mergeChanged = settings.mergeToleranceMs !== standalone.lyrics.mergeToleranceMs || settings.secondaryOffsetMs !== standalone.lyrics.secondaryOffsetMs;
        signature = nextSignature; configure(standalone.lyrics);
        if (mergeChanged) controller.refreshMerge(); else controller.update('settings', true);
    });
    // A web-font finishing its load can change line wrapping; reflow the bounded stack once.
    document.fonts?.addEventListener('loadingdone', () => controller.update('settings', true));
    function tick(timestamp) {
        frame = requestAnimationFrame(tick);
        if (!audio.paused && !audio.seeking) controller.update('play');
        const dt = lastTime ? Math.min(1000, timestamp - lastTime) : 16; lastTime = timestamp;
        let bass = 0;
        const state = controller.getState();
        const interlude = state.interlude;
        if (!audio.paused && !audio.ended && settings.enabled && settings.glowEnabled && phase === 'ACTIVE' && !interlude) {
            const samples = window.audioSample;
            if (samples) for (let i = 0; i < 5; i++) bass += Math.max(0, samples[i] || 0);
        }
        bassEnvelope = window.VisualizerLyricsRuntime.envelope(bassEnvelope, bass * settings.glowBassSensitivity, dt, settings.glowAttack, settings.glowRelease);
        const opacity = settings.glowEnabled ? settings.glowBaseOpacity + (settings.glowMaxOpacity - settings.glowBaseOpacity) * bassEnvelope : 0;
        stack.style.setProperty('--lyric-glow-opacity', opacity.toFixed(4));
        stack.style.setProperty('--lyric-glow-blur', (settings.glowBlur * (1 + bassEnvelope * 0.45)).toFixed(2) + 'px');
        stack.style.setProperty('--lyric-glow-scale', (1 + (settings.glowSpread - 1) * (0.35 + bassEnvelope * 0.65)).toFixed(4));
        // A focused halo preserves visible bass contrast; the wide blurred duplicate alone
        // loses most of its luminance behind the opaque primary text.
        const color = settings.glowColorMode === 'text' ? settings.currentColor : settings.glowColor;
        const rgb = [1, 3, 5].map(start => parseInt(color.slice(start, start + 2), 16));
        stack.style.setProperty('--lyric-glow-core-color', 'rgba(' + rgb.join(',') + ',' + opacity.toFixed(4) + ')');
        stack.style.setProperty('--lyric-glow-core-radius', (settings.glowBlur * (0.12 + bassEnvelope * 0.28)).toFixed(2) + 'px');
        const current = pool.find(item => item.interlude && item.node.dataset.focus === 'current' && !item.node.hidden);
        if (current && interlude && phase === 'ACTIVE') {
            current.dotNodes.forEach((dot, index) => {
                const local = interlude.phase * 3 - index;
                const pulse = !reducedMotion.matches && local >= 0 && local <= 1 ? Math.sin(Math.PI * local) ** 2 : 0;
                dot.style.transform = 'translateY(' + (-3 * pulse).toFixed(3) + 'px) scale(' + (1 + .04 * pulse).toFixed(4) + ')';
                dot.style.opacity = (.65 + .3 * pulse).toFixed(4);
            });
        }
    }
    window.addEventListener('pagehide', event => {
        if (event.persisted) return;
        cancelAnimationFrame(frame); controller.destroy(); cancelExit(); for (const item of pool) cancel(item);
    });
    frame = requestAnimationFrame(tick);
    window.VisualizerLyrics = controller;
}());

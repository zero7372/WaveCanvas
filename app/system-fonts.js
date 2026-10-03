(function () {
    'use strict';
    const generic = Object.freeze(['system-ui', 'sans-serif', 'serif', 'monospace']);
    const safeFamilies = Object.freeze(['system-ui', 'Arial', 'Segoe UI', 'Microsoft JhengHei', 'Noto Sans', 'Georgia', 'Times New Roman', 'Courier New', 'monospace', 'sans-serif', 'serif']);
    const fallback = '"Microsoft JhengHei", "PingFang TC", "Noto Sans CJK TC", "Noto Sans JP", system-ui, sans-serif';
    const listeners = new Set(); let families = safeFamilies, loading, status = 'idle', error = null;
    // The project owns this string. Available fonts only supply UI choices.
    function normalize(family) { return typeof family === 'string' ? family.trim() || 'system-ui' : 'system-ui'; }
    function quote(family) { return '"' + family.replace(/["\\\x00-\x1f\x7f]/g, character => '\\' + character.codePointAt(0).toString(16) + ' ') + '"'; }
    function fontStack(family) {
        family = normalize(family);
        if (generic.includes(family)) return family + ', ' + fallback;
        const tail = ['Georgia', 'Times New Roman'].includes(family) ? 'serif' : family === 'Courier New' ? 'monospace' : 'sans-serif';
        return quote(family) + ', ' + fallback.replace(/, sans-serif$/, ', ' + tail);
    }
    function options() { return families.map(value => ({ value, label: value === 'system-ui' ? '系統字型' : value })); }
    function canonical(fonts) {
        const seen = new Set(generic.map(name => name.toLowerCase())), installed = [];
        for (const font of fonts) {
            if (typeof font?.family !== 'string') continue;
            const name = font.family.trim(), key = name.toLowerCase();
            if (!name || seen.has(key)) continue;
            seen.add(key); installed.push(name);
        }
        installed.sort(new Intl.Collator(undefined, { sensitivity:'base', numeric:true }).compare);
        return installed.length ? Object.freeze([...generic, ...installed]) : null;
    }
    function load() {
        if (loading) return loading;
        loading = (async () => {
            try {
                if (!('queryLocalFonts' in window)) { status = 'unavailable'; return families; }
                const next = canonical(await window.queryLocalFonts());
                if (next) { families = next; status = 'available'; } else status = 'empty';
            } catch (failure) { status = 'failed'; error = { name:failure.name || 'Error', message:String(failure.message || failure) }; }
            finally { for (const listener of listeners) listener(); }
            return families;
        })();
        return loading;
    }
    function bindSelect(input, currentValue) {
        let previousFamilies, previousValue;
        function sync() {
            const current = normalize(currentValue());
            if (previousFamilies === families && previousValue === current) return;
            previousFamilies = families; previousValue = current;
            const choices = options();
            // Preserve exact project identity even when absent or differently cased.
            if (!choices.some(option => option.value === current)) choices.unshift({ value:current, label:current });
            input.replaceChildren(...choices.map(choice => {
                const node = document.createElement('option'); node.value = choice.value; node.textContent = choice.label; node.style.fontFamily = fontStack(choice.value); return node;
            }));
            input.value = current; input.style.fontFamily = fontStack(current);
        }
        listeners.add(sync); input.addEventListener('focus', load); input.addEventListener('pointerdown', load); sync(); return sync;
    }
    window.VisualizerSystemFonts = Object.freeze({ get families() { return families; }, get options() { return options(); }, fallback, normalize, fontStack, load, bindSelect,
        getState() { return { status, familyCount:families.length, installedFamilyCount:status === 'available' ? families.length - generic.length : 0, error }; } });
    // Desktop grants local-fonts only to the bundled editor. Query once it is focused.
    // Browser queries on a font control gesture and keeps the ordinary permission flow.
    if (window.waveCanvas) window.addEventListener('focus', load, { once:true });
}());

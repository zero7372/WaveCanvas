(function () {
    'use strict';
    const runtime = window.VisualizerRuntime;
    if (runtime.mode !== 'standalone') return;
    const parent = document.querySelector('[data-group="Background"] .group-content');
    const controls = new Map();
    const note = document.createElement('p'); note.className = 'schema-note';
    note.textContent = '圖片以 cover 填滿，邊緣自動預留安全縮放。位置與模糊使用 1920×1080 畫布像素。';
    for (const [key, field] of Object.entries(window.VisualizerBackgroundSettings.properties)) {
        const row = document.createElement('div'); row.className = 'setting-row'; row.dataset.backgroundProperty = key;
        const label = document.createElement('label'); label.htmlFor = 'background-' + key; label.textContent = field.text;
        const input = document.createElement(field.type === 'combo' ? 'select' : 'input'); input.id = label.htmlFor;
        const inputs = [input]; row.append(label);
        if (field.type === 'slider') {
            input.type = 'range'; const number = document.createElement('input'); number.type = 'number'; number.setAttribute('aria-label', field.text + '數值'); inputs.push(number);
            for (const control of inputs) { control.min = field.min; control.max = field.max; control.step = field.step; }
            const pair = document.createElement('div'); pair.className = 'numeric-pair'; pair.append(...inputs); row.append(pair);
        } else if (field.type === 'bool') {
            input.type = 'checkbox'; row.classList.add('bool-row'); row.append(input);
        } else if (field.type === 'combo') {
            for (const option of field.options) {
                const node = document.createElement('option'); node.value = option.value; node.textContent = option.label; input.append(node);
            }
            row.append(input);
        } else { input.type = 'color'; row.append(input); const value = document.createElement('output'); value.className = 'color-value'; inputs.push(value); row.append(value); }
        for (const control of inputs.filter(node => node.tagName !== 'OUTPUT')) {
            function commit(final) {
                const value = field.type === 'bool' ? control.checked : field.type === 'slider' ? Number(control.value) : control.value;
                if (field.type === 'slider' && (control.value === '' || !Number.isFinite(value) || !final && (value < field.min || value > field.max))) return;
                runtime.updateStandalone({ background: { [key]: value } });
            }
            control.addEventListener('input', () => commit(false));
            control.addEventListener('change', () => { commit(true); sync(runtime.getSettings(), runtime.getStandalone()); });
        }
        parent.append(row); controls.set(key, { inputs, row });
    }
    // Keep schema-driven file/color source controls, then place the new image settings together.
    const order = ['enabled', 'mode', 'opacity', 'blur', 'backingColor', 'baseScale', 'driftAmount', 'driftSpeed', 'offsetX', 'offsetY', 'bassScaleAmount', 'bassAttack', 'bassRelease'];
    parent.prepend(controls.get('enabled').row);
    for (const key of order.slice(1)) parent.append(controls.get(key).row);
    parent.append(note);
    function sync(properties, standalone) {
        const settings = standalone.background, enabled = properties.backgroundsource.value === 2;
        for (const [key, { inputs, row }] of controls) {
            const field = window.VisualizerBackgroundSettings.properties[key];
            row.dataset.active = String(enabled);
            row.hidden = key !== 'enabled' && (!enabled || !settings.enabled || field.mode && field.mode !== settings.mode);
            for (const input of inputs) {
                if (input.tagName === 'OUTPUT') input.textContent = settings[key].toUpperCase();
                else if (field.type === 'bool') input.checked = settings[key];
                else { input.value = settings[key]; }
            }
        }
    }
    runtime.subscribe(sync);
}());

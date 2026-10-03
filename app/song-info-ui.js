(function () {
    'use strict';
    const runtime = window.VisualizerRuntime;
    if (runtime.mode !== 'standalone') return;
    const details = document.createElement('details'); details.className = 'settings-group'; details.dataset.group = 'Song Info';
    const summary = document.createElement('summary'); summary.textContent = '歌曲資訊'; details.append(summary);
    const content = document.createElement('div'); content.className = 'group-content'; details.append(content);
    const controls = new Map();
    const sections = { borderEnabled: '邊框／外發光', bassReaction: '低頻反應' };
    for (const [key, field] of Object.entries(window.VisualizerSongInfoSettings.properties)) {
        if (sections[key]) { const heading = document.createElement('h3'); heading.className = 'subheading'; heading.textContent = sections[key]; content.append(heading); }
        const row = document.createElement('div'); row.className = 'setting-row'; row.dataset.textProperty = key;
        const label = document.createElement('label'); label.htmlFor = 'text-' + key; label.textContent = field.text; row.append(label);
        const input = document.createElement(field.type === 'combo' ? 'select' : 'input'); input.id = label.htmlFor;
        const inputs = [input];
        if (field.type === 'slider') {
            input.type = 'range'; const number = document.createElement('input'); number.type = 'number'; number.setAttribute('aria-label', field.text + '數值'); inputs.push(number);
            for (const node of inputs) { node.min = field.min; node.max = field.max; node.step = field.step; }
            const pair = document.createElement('div'); pair.className = 'numeric-pair'; pair.append(...inputs); row.append(pair);
        } else if (field.type === 'combo') {
            for (const option of field.options) {
                const node = document.createElement('option'); node.value = option.value; node.textContent = option.label;
                if (key === 'fontFamily') node.style.fontFamily = window.VisualizerSystemFonts.fontStack(option.value);
                input.append(node);
            }
            row.append(input);
        } else {
            input.type = field.type === 'bool' ? 'checkbox' : field.type === 'color' ? 'color' : 'text';
            if (field.type === 'bool') row.classList.add('bool-row');
            if (field.type === 'string') input.maxLength = 500;
            row.append(input);
            if (field.type === 'color') { const output = document.createElement('output'); output.className = 'color-value'; row.append(output); inputs.push(output); }
        }
        function commit(node, final = false) {
            const value = field.type === 'bool' ? node.checked : field.type === 'slider' ? Number(node.value) : node.value;
            if (field.type === 'slider' && (node.value === '' || !Number.isFinite(value) || !final && (value < field.min || value > field.max))) return;
            runtime.updateStandalone({ text: { [key]: value } });
        }
        for (const node of inputs.filter(node => node.tagName !== 'OUTPUT')) {
            node.addEventListener(['slider', 'string', 'color'].includes(field.type) ? 'input' : 'change', () => commit(node));
            if (field.type === 'slider') node.addEventListener('change', () => { commit(node, true); sync(runtime.getStandalone().text); });
        }
        content.append(row); controls.set(key, { row, inputs, field });
    }
    function sync(settings) {
        for (const [key, { row, inputs, field }] of controls) {
            row.hidden = ['borderColor', 'borderWidth', 'borderBlur'].includes(key) && !settings.borderEnabled || key === 'bassStrength' && !settings.bassReaction;
            for (const node of inputs) {
                if (node.tagName === 'OUTPUT') node.textContent = settings[key].toUpperCase();
                else if (field.type === 'bool') node.checked = settings[key]; else node.value = settings[key];
            }
        }
        controls.get('fontFamily').inputs[0].style.fontFamily = window.VisualizerSystemFonts.fontStack(settings.fontFamily);
    }
    runtime.subscribe((_, standalone) => sync(standalone.text));
    document.querySelector('#settings-groups').append(details);
}());

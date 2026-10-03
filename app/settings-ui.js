(function () {
    'use strict';
    const runtime = window.VisualizerRuntime;
    if (runtime.mode !== 'standalone') return;
    const schema = runtime.getSchema().properties;
    const locale = window.VisualizerLocale;
    const chrome = document.querySelector('#standalone-chrome');
    const panel = document.querySelector('#settings-panel');
    const toggle = document.querySelector('#settings-toggle');
    const groupsRoot = document.querySelector('#settings-groups');
    const status = document.querySelector('#settings-status');
    const coverStatus = document.querySelector('#cover-status');
    const controls = new Map();
    const groups = new Map();
    const compatibility = window.VisualizerPropertyCompatibility;
    // Only section aliases are maintained here; every property is discovered from schema order and metadata.
    const sectionAliases = { background: 'Background', circle1: 'Circle', circle: 'Circle', center: 'Center / Position', barandcircledistance: 'Center / Position', bars: 'Bars', particles: 'Particles', overlay: 'Overlay', bassmultiplier: 'Bass' };

    function labelText(html) {
        const template = document.createElement('template');
        template.innerHTML = html || '';
        return template.content.textContent.trim(); // Schema markup is never inserted into the live document.
    }
    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }
    function group(name) {
        if (groups.has(name)) return groups.get(name);
        const details = element('details', 'settings-group');
        details.dataset.group = name;
        details.open = name === 'Audio';
        details.append(element('summary', '', locale.text(name)));
        const content = element('div', 'group-content');
        details.append(content);
        groupsRoot.append(details);
        groups.set(name, content);
        return content;
    }
    function report(message, error = false) {
        status.textContent = message;
        status.dataset.error = String(error);
    }
    function update(key, value) {
        try { runtime.updateProperties({ [key]: { value } }); report('已更新設定'); }
        catch (error) { report(error.message, true); synchronize(runtime.getSettings(), runtime.getStandalone()); }
    }
    function toHex(value) {
        return '#' + value.split(' ').map(part => Math.round(Number(part) * 255).toString(16).padStart(2, '0')).join('');
    }
    function fromHex(value) {
        return [1, 3, 5].map(index => String(parseInt(value.slice(index, index + 2), 16) / 255)).join(' ');
    }

    // Restricted condition parser: literals, property.value, equality, !, &&, || and parentheses only; no eval.
    function conditionActive(expression, settings) {
        if (!expression) return true;
        const tokens = expression.match(/\w+\.value|true|false|\d+(?:\.\d+)?|===|!==|==|!=|&&|\|\||[!()]/g) || [];
        if (tokens.join('') !== expression.replace(/\s+/g, '')) return false;
        let index = 0;
        function atom() {
            const token = tokens[index++];
            if (token === '!') return !atom();
            if (token === '(') { const value = or(); if (tokens[index++] !== ')') throw new Error('Invalid condition'); return value; }
            if (token === 'true') return true;
            if (token === 'false') return false;
            if (/^\d/.test(token || '')) return Number(token);
            if (token?.endsWith('.value')) return settings[token.slice(0, -6)]?.value;
            throw new Error('Invalid condition');
        }
        function equality() {
            let value = atom();
            const operator = tokens[index];
            if (['==', '!=', '===', '!=='].includes(operator)) {
                index++;
                const right = atom();
                // WE conditions use loose comparison, e.g. empty file string == false.
                if (operator === '==') value = value == right;
                if (operator === '!=') value = value != right;
                if (operator === '===') value = value === right;
                if (operator === '!==') value = value !== right;
            }
            return value;
        }
        function and() { let value = equality(); while (tokens[index] === '&&') { index++; const right = equality(); value = Boolean(value && right); } return value; }
        function or() { let value = and(); while (tokens[index] === '||') { index++; const right = and(); value = Boolean(value || right); } return value; }
        try { const result = or(); return index === tokens.length && Boolean(result); } catch { return false; }
    }

    function numericRow(key, definition, parent, standaloneOnly = false) {
        const row = element('div', 'setting-row');
        const label = element('label', '', definition.text);
        label.htmlFor = 'setting-' + key;
        const pair = element('div', 'numeric-pair');
        const range = element('input'); range.type = 'range'; range.id = label.htmlFor;
        const number = element('input'); number.type = 'number'; number.setAttribute('aria-label', definition.text + '數值');
        for (const input of [range, number]) {
            input.min = definition.min; input.max = definition.max; input.step = standaloneOnly ? '0.05' : '1';
        }
        const commit = (input, final = false) => {
            const value = Number(input.value);
            if (input.value === '' || !Number.isFinite(value)) {
                if (final) synchronize(runtime.getSettings(), runtime.getStandalone());
                return;
            }
            if (!final && (value < definition.min || value > definition.max)) return;
            const bounded = Math.min(definition.max, Math.max(definition.min, value));
            const safe = standaloneOnly ? bounded : Math.round(bounded);
            if (standaloneOnly) runtime.updateStandalone({ inputGain: safe });
            else update(key, safe);
        };
        range.addEventListener('input', () => commit(range));
        number.addEventListener('input', () => commit(number));
        number.addEventListener('change', () => commit(number, true));
        pair.append(range, number);
        row.append(label, pair);
        if (standaloneOnly) row.append(element('small', 'setting-note', '僅限獨立模式 · 0.25×–4.0×'));
        parent.append(row);
        return { row, inputs: [range, number], sync: value => { range.value = value; number.value = value; } };
    }

    const inputGain = numericRow('inputGain', { text: '輸入增益', min: 0.25, max: 4 }, group('Audio'), true);
    let currentGroup = 'Audio';
    for (const [key, definition] of Object.entries(schema).sort((a, b) => a[1].order - b[1].order)) {
        if (!compatibility.visible(key)) continue;
        if (definition.type === 'text') {
            const heading = /<h\d\b/i.test(definition.text);
            if (heading) currentGroup = sectionAliases[key] || labelText(definition.text);
            const note = element(heading ? 'h3' : 'p', heading ? 'subheading' : 'schema-note', locale.property(key));
            note.dataset.metadata = key;
            group(currentGroup).append(note);
            continue;
        }
        const targetGroup = key === 'schemecolor' || key === 'frameratepersecond' ? 'Other' : currentGroup;
        const parent = group(targetGroup);
        const title = window.VisualizerInspectorPolicy.labels[key] || locale.property(key);
        let control;
        if (definition.type === 'slider') {
            control = numericRow(key, { ...definition, text: title }, parent);
        } else {
            const row = element('div', 'setting-row');
            const label = element('label', '', key === 'logoimage' ? '封面／' + title : title);
            label.htmlFor = 'setting-' + key;
            const input = element(definition.type === 'combo' ? 'select' : 'input');
            input.id = label.htmlFor;
            row.append(label);
            let sync;
            let inputs = [input];
            switch (definition.type) {
                case 'bool':
                    input.type = 'checkbox'; row.classList.add('bool-row');
                    input.addEventListener('change', () => update(key, input.checked));
                    sync = value => { input.checked = value; };
                    row.append(input);
                    break;
                case 'color': {
                    input.type = 'color';
                    const valueLabel = element('output', 'color-value');
                    input.addEventListener('input', () => update(key, fromHex(input.value)));
                    sync = value => { input.value = toHex(value); valueLabel.textContent = input.value.toUpperCase(); valueLabel.title = value; };
                    const pair = element('div', 'color-pair'); pair.append(input, valueLabel); row.append(pair);
                    break;
                }
                case 'combo':
                    for (const option of compatibility.options(key, definition.options)) { const node = element('option', '', locale.text(option.label)); node.value = option.value; input.append(node); }
                    input.addEventListener('change', () => update(key, Number(input.value)));
                    sync = value => { input.value = value; };
                    row.append(input);
                    break;
                case 'file':
                case 'directory': {
                    input.type = 'file'; input.accept = '.png,.jpg,.jpeg,.webp'; input.multiple = false;
                    const fileName = element('small', 'file-name', '尚未選取');
                    const clear = element('button', 'quiet-button', '清除'); clear.type = 'button'; clear.setAttribute('aria-label', '清除' + title);
                    input.addEventListener('change', async () => {
                        const files = Array.from(input.files);
                        input.value = '';
                        try {
                            if (await window.VisualizerFiles.select(key, files)) {
                                report('圖片已更新');
                                if (key === 'logoimage') coverStatus.textContent = '封面：' + window.VisualizerFiles.getName(key);
                            }
                        } catch (error) {
                            report(error.message, true);
                            if (key === 'logoimage') coverStatus.textContent = error.message;
                        }
                    });
                    clear.addEventListener('click', () => { window.VisualizerFiles.clear(key); report('圖片已清除'); });
                    sync = value => { fileName.textContent = window.VisualizerFiles.getName(key) || (value ? '已設定來源' : '尚未選取'); };
                    inputs.push(clear);
                    row.append(input, fileName, clear);
                    break;
                }
            }
            parent.append(row);
            control = { row, inputs, sync };
        }
        control.row.dataset.property = key;
        control.row.title = key;
        if (definition.condition) {
            const hint = element('small', 'condition-note');
            control.row.append(hint);
            control.hint = hint;
        }
        controls.set(key, control);
    }
    groupsRoot.append(groups.get('Other').parentElement);

    function synchronize(settings, standalone) {
        inputGain.sync(standalone.inputGain);
        for (const [key, control] of controls) {
            control.sync(settings[key].value);
            const policy = window.VisualizerInspectorPolicy;
            const active = policy.propertyApplies(key, standalone.visualizer.layout)
                && conditionActive(policy.condition(key, schema[key].condition, standalone.visualizer.layout), settings);
            control.row.dataset.active = String(active);
            control.row.hidden = !active;
        }
        window.dispatchEvent(new Event('visualizer-settings-ui-sync'));
    }
    runtime.subscribe(synchronize);
    window.VisualizerFiles.subscribe(() => {
        synchronize(runtime.getSettings(), runtime.getStandalone());
        coverStatus.textContent = window.VisualizerFiles.getName('logoimage') ? '封面：' + window.VisualizerFiles.getName('logoimage') : '';
    });
    document.querySelector('#cover-open').addEventListener('click', () => document.querySelector('#setting-logoimage').click());
    function setOpen(open) {
        panel.hidden = !open;
        toggle.setAttribute('aria-expanded', String(open));
        toggle.textContent = open ? '收合設定' : '設定';
        window.dispatchEvent(new Event('resize'));
    }
    toggle.addEventListener('click', () => setOpen(panel.hidden));
    document.querySelector('#settings-close').addEventListener('click', () => { setOpen(false); toggle.focus(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) setOpen(false); });

    const presetName = document.querySelector('#preset-name');
    const downloadLink = document.querySelector('#preset-download');
    const jsonFallback = document.querySelector('#preset-json-fallback');
    const jsonText = document.querySelector('#preset-json');
    let presetURL = null;
    document.querySelector('#export-preset').addEventListener('click', () => {
        const preset = window.VisualizerPresets.create(presetName.value || '未命名');
        jsonText.value = JSON.stringify(preset, null, 2);
        jsonFallback.hidden = false;
        if (presetURL) URL.revokeObjectURL(presetURL);
        presetURL = URL.createObjectURL(new Blob([jsonText.value], { type: 'application/json' }));
        downloadLink.href = presetURL;
        downloadLink.download = preset.name.replace(/[^\p{L}\p{N} _-]/gu, '_') + '.json';
        downloadLink.hidden = false;
        downloadLink.click();
        report('預設組 JSON 已產生並請求下載；圖片與音訊不包含在檔案內。');
    });
    window.addEventListener('pagehide', event => { if (!event.persisted && presetURL) URL.revokeObjectURL(presetURL); });
    document.querySelector('#copy-preset').addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(jsonText.value); report('預設組 JSON 已複製。'); }
        catch { jsonText.focus(); jsonText.select(); report('請複製已選取的 JSON，儲存為 .json 檔案。'); }
    });
    const presetInput = document.querySelector('#import-preset');
    let importVersion = 0;
    document.querySelector('#import-preset-button').addEventListener('click', () => presetInput.click());
    presetInput.addEventListener('change', async () => {
        const file = presetInput.files[0]; presetInput.value = '';
        if (!file) return;
        const version = ++importVersion;
        try {
            if (file.size > 1024 * 1024) throw new Error('預設組必須小於 1 MB。');
            const text = await file.text();
            if (version !== importVersion) return;
            const result = window.VisualizerPresets.import(text);
            presetName.value = result.name;
            report('預設組已載入。圖片來源已清除，請重新選取。' + (result.warnings.length ? ' 已忽略／還原 ' + result.warnings.length + ' 個項目。' : ''));
        } catch (error) { if (version === importVersion) report(error.message, true); }
    });
    document.querySelector('#reset-defaults').addEventListener('click', () => {
        importVersion++;
        window.VisualizerPresets.reset(); presetName.value = '未命名'; report('已恢復目前排列的原廠預設值；輸入增益 ' + runtime.getStandalone().inputGain + '×。');
    });
    chrome.hidden = false;
    panel.hidden = true;
    window.dispatchEvent(new Event('resize'));
}());

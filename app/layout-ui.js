(function () {
    'use strict';
    const runtime = window.VisualizerRuntime;
    if (runtime.mode !== 'standalone') return;
    const details = document.createElement('details'); details.className = 'settings-group'; details.open = true;
    details.dataset.group = 'Geometry / Layout';
    const summary = document.createElement('summary'); summary.textContent = '幾何／排列'; details.append(summary);
    const content = document.createElement('div'); content.className = 'group-content'; details.append(content);
    const note = document.createElement('p'); note.className = 'schema-note';
    note.textContent = '16:9 · 1920×1080 畫布。圓形模式使用原圓形／頻譜柱／中心設定；以下幾何參數供方形／直線模式使用。位置為畫布百分比；寬高為畫布像素。'; content.append(note);
    const controls = new Map();
    for (const [key, definition] of Object.entries(window.VisualizerLayoutSettings.properties)) {
        const row = document.createElement('div'); row.className = 'setting-row'; row.dataset.layoutProperty = key;
        const label = document.createElement('label'); label.htmlFor = 'layout-' + key; label.textContent = window.VisualizerLocale.text(definition.text); row.append(label);
        const input = document.createElement(definition.type === 'combo' ? 'select' : 'input'); input.id = label.htmlFor;
        const inputs = [input];
        if (definition.type === 'combo') {
            for (const option of definition.options) { const node = document.createElement('option'); node.value = option.value; node.textContent = window.VisualizerLocale.text(option.label); input.append(node); }
            row.append(input);
        } else if (definition.type === 'bool') { input.type = 'checkbox'; row.classList.add('bool-row'); row.append(input); }
        else {
            input.type = 'range'; const numeric = document.createElement('input'); numeric.type = 'number';
            numeric.setAttribute('aria-label', label.textContent + '數值'); inputs.push(numeric);
            for (const node of inputs) { node.min = definition.min; node.max = definition.max; node.step = definition.step; }
            const pair = document.createElement('div'); pair.className = 'numeric-pair'; pair.append(...inputs); row.append(pair);
        }
        function commit(node, final) {
            const value = definition.type === 'bool' ? node.checked : definition.type === 'combo' ? node.value : Number(node.value);
            if (definition.type === 'slider' && (node.value === '' || !Number.isFinite(value) || (!final && (value < definition.min || value > definition.max)))) return;
            runtime.updateStandalone({ visualizer: { [key]: value } });
        }
        for (const node of inputs) {
            node.addEventListener(definition.type === 'slider' ? 'input' : 'change', () => commit(node, false));
            if (definition.type === 'slider') node.addEventListener('change', () => { commit(node, true); sync(runtime.getStandalone().visualizer); });
        }
        content.append(row); controls.set(key, { row, inputs, definition });
    }
    const help = document.createElement('p'); help.className = 'schema-note';
    help.textContent = '直線模式的寬度／高度是範圍：水平排列為長度／振幅，垂直排列為振幅／長度。柱寬與間距權重的比例決定排距；錨點決定位置點對齊起點、中央或終點。中心鏡射會鏡射頻率順序；雙側反向則在基線兩側繪製。'; content.append(help);
    const squareHelp = document.createElement('p'); squareHelp.className = 'schema-note';
    const squareDescriptions = {
        symmetric: '四邊共用頻譜，每邊中心鏡像，低頻集中於每條邊中央。',
        topBassMirror: '低頻集中於頂邊中央，左右鏡像；頻率沿左右側邊延續至下邊中央，不在側邊重新開始。',
        foldedDiagonal: '右上／左下為低頻折點，頻率沿 Top → Right、Bottom → Left 兩組相鄰邊延伸，形成對角對稱。'
    };
    content.append(squareHelp);
    document.querySelector('#settings-groups').prepend(details);
    function sync(settings) {
        squareHelp.hidden = settings.layout !== 'square';
        squareHelp.textContent = (squareDescriptions[settings.squareSpectrumLayout] || squareDescriptions.symmetric)
            + '（反轉頻率順序會反轉低／高頻位置。）柱數取最接近的 4 倍數，64 = 每邊 16 條；角落留白，預設向外生長。鏡射選項只供直線模式。';
        for (const [key, { row, inputs, definition }] of controls) {
            const active = key === 'layout' || (settings.layout !== 'circle'
                && (!['orientation', 'anchor', 'amplitudeDirection', 'width', 'gap'].includes(key) || settings.layout === 'linear' || key === 'gap')
                && (!['squareSize', 'direction', 'squareSpectrumLayout'].includes(key) || settings.layout === 'square')
                && (key !== 'mirror' || settings.layout !== 'square'));
            row.dataset.active = String(active);
            row.hidden = !active;
            for (const input of inputs) {
                if (definition.type === 'bool') input.checked = settings[key]; else input.value = settings[key];
            }
        }
    }
    runtime.subscribe((_, standalone) => sync(standalone.visualizer));
}());

(function () {
    'use strict';
    if (window.VisualizerRuntime.mode !== 'standalone') return;
    const root = document.querySelector('#template-cards');
    function node(tag, className, text) {
        const element = document.createElement(tag); element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }
    for (const definition of window.VisualizerTemplates.definitions) {
        // 整張模板（畫面＋名稱）就是一個按鈕，不再另外放「使用此模板」。
        const card = node('button', 'template-card'); card.type = 'button'; card.dataset.templateId = definition.id; card.dataset.template = definition.layout;
        const image = node('img', 'template-thumbnail'); image.src = definition.thumbnail;
        window.WaveCanvasI18nDom.attr(image, 'alt', '{name} 模板靜態預覽', { name: definition.name }); image.decoding = 'async';
        const body = node('div', 'template-card-content');
        const title = node('span', 'template-title'), name = node('span', 'template-name', definition.name);
        const subtitle = node('span', 'template-subtitle', definition.subtitle);
        const description = node('span', 'template-description', definition.description);
        title.append(name, subtitle);
        window.WaveCanvasI18nDom.attr(card, 'aria-label', '{name}：使用此模板', { name: definition.name });
        card.addEventListener('click', () => {
            window.VisualizerTemplates.apply(definition.id);
            window.WaveCanvasShell.showView('EDITOR');
            window.WaveCanvasI18nDom.text(document.querySelector('#settings-status'), '已套用 {name} 模板；保留目前素材。', { name: definition.name });
        });
        body.append(title, description); card.append(image, body); root.append(card);
        // previewVideo is reserved metadata; this phase always renders a static image.
    }
}());

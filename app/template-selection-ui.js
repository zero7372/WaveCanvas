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
        const card = node('article', 'template-card'); card.dataset.templateId = definition.id;
        const image = node('img', 'template-thumbnail'); image.src = definition.thumbnail;
        window.WaveCanvasI18nDom.attr(image, 'alt', '{name} 模板靜態預覽', { name: definition.name }); image.decoding = 'async';
        const body = node('div', 'template-card-content');
        const title = node('h3', 'template-title', definition.name);
        const subtitle = node('p', 'template-subtitle', definition.subtitle);
        const description = node('p', 'template-description', definition.description);
        const button = node('button', 'template-apply', '使用此模板'); button.type = 'button';
        button.dataset.template = definition.layout;
        window.WaveCanvasI18nDom.attr(button, 'aria-label', '{name}：使用此模板', { name: definition.name });
        button.addEventListener('click', () => {
            window.VisualizerTemplates.apply(definition.id);
            window.WaveCanvasShell.showView('EDITOR');
            window.WaveCanvasI18nDom.text(document.querySelector('#settings-status'), '已套用 {name} 模板；保留目前素材。', { name: definition.name });
        });
        body.append(title, subtitle, description, button); card.append(image, body); root.append(card);
        // previewVideo is reserved metadata; this phase always renders a static image.
    }
}());

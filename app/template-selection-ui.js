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
        image.alt = definition.name + ' 模板靜態預覽'; image.decoding = 'async';
        const body = node('div', 'template-card-content');
        const title = node('h3', 'template-title', definition.name);
        const subtitle = node('p', 'template-subtitle', definition.subtitle);
        const description = node('p', 'template-description', definition.description);
        const button = node('button', 'template-apply', '使用此模板'); button.type = 'button';
        button.dataset.template = definition.layout;
        button.setAttribute('aria-label', definition.name + '：使用此模板');
        button.addEventListener('click', () => {
            window.VisualizerTemplates.apply(definition.id);
            window.WaveCanvasShell.showView('EDITOR');
            document.querySelector('#settings-status').textContent = '已套用 ' + definition.name + ' 模板；保留目前素材。';
        });
        body.append(title, subtitle, description, button); card.append(image, body); root.append(card);
        // previewVideo is reserved metadata; this phase always renders a static image.
    }
}());

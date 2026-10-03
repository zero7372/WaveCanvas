(function () {
    'use strict';
    function create(title) {
        const dialog = document.createElement('dialog'); dialog.className = 'app-dialog';
        const heading = document.createElement('h2'); heading.textContent = title; heading.id = 'dialog-' + crypto.randomUUID();
        dialog.setAttribute('aria-labelledby', heading.id); dialog.append(heading); document.body.append(dialog);
        return dialog;
    }
    function button(label, className = '') { const element = document.createElement('button'); element.type = 'button'; element.textContent = label; element.className = className; return element; }
    async function confirm(title, message) {
        const dialog = create(title), text = document.createElement('p'), actions = document.createElement('footer'); text.textContent = message;
        const cancel = button('取消'), accept = button('確認', 'primary-button'); actions.append(cancel, accept); dialog.append(text, actions);
        return new Promise(resolve => { dialog.addEventListener('close', () => { const result = dialog.returnValue === 'yes'; dialog.remove(); resolve(result); }, { once: true });
            cancel.onclick = () => dialog.close(); accept.onclick = () => dialog.close('yes'); dialog.showModal(); cancel.focus(); });
    }
    window.WaveCanvasDialogs = Object.freeze({ create, button, confirm });
}());

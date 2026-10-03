(function () {
    'use strict';
    let active = false;
    async function show(kind, initial = '') {
        if (active) return null; active = true;
        const ui = window.WaveCanvasDialogs, names = window.WaveCanvasProjectNames;
        const dialog = ui.create(kind === 'new' ? '建立新專案' : '重新命名專案'); dialog.id = 'project-name-dialog';
        const form = document.createElement('form'), label = document.createElement('label'), input = document.createElement('input'), error = document.createElement('p'), actions = document.createElement('footer');
        input.id = 'project-name-input'; input.type = 'text'; input.value = initial; input.autocomplete = 'off'; input.maxLength = names.maxLength * 2;
        label.htmlFor = input.id; label.textContent = '專案名稱'; error.className = 'dialog-message'; error.setAttribute('role', 'status');
        const cancel = ui.button('取消'), accept = ui.button(kind === 'new' ? '建立' : '確認', 'primary-button'); accept.type = 'submit'; accept.id = 'project-name-submit';
        actions.append(cancel);
        if (kind === 'new') { const later = ui.button('稍後命名'); later.id = 'project-name-later'; later.onclick = () => { input.value = 'Untitled'; dialog.close('accept'); }; actions.append(later); }
        actions.append(accept); form.append(label, input, error, actions); dialog.append(form);
        function validate() { try { names.normalize(input.value); accept.disabled = false; error.textContent = ''; } catch (e) { accept.disabled = true; error.textContent = input.value ? e.message : ''; } }
        input.oninput = validate; validate(); cancel.onclick = () => dialog.close();
        form.onsubmit = event => { event.preventDefault(); validate(); if (!accept.disabled) dialog.close('accept'); };
        return new Promise(resolve => { dialog.addEventListener('close', () => { const result = dialog.returnValue === 'accept' ? names.normalize(input.value) : null; dialog.remove(); active = false; resolve(result); }, { once: true });
            dialog.showModal(); input.focus(); input.select(); });
    }
    window.WaveCanvasProjectNameDialog = Object.freeze({ show });
}());

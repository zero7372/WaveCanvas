(function () {
    'use strict';
    if (window.VisualizerRuntime.mode !== 'standalone') return;
    const controller = window.WaveCanvasProject, api = window.waveCanvas?.project;
    const $ = selector => document.querySelector(selector);
    function command(button, name) {
        button.disabled = !controller; button.title = controller ? '' : 'Desktop App 功能'; button.dataset.projectCommand = name;
        button.addEventListener('click', () => {
            if (!controller) return;
            for (const menu of document.querySelectorAll('.app-menu')) menu.open = false;
            const work = name === 'open' ? controller.open() : name === 'new' ? controller.newProject() : name === 'rename' ? controller.rename() : name === 'collect' ? controller.collect() : controller.save(name);
            work.catch(error => { $('#shell-status').textContent = error.message; });
        });
    }
    const fileMenu = $('.app-menu div');
    const projectCommands = document.createDocumentFragment();
    // 快捷鍵另外放在靠右的 span，不和標籤串在一起。
    for (const [name, label, keys] of [['new', '新增專案'], ['open', '開啟專案…', 'Ctrl+O'], ['rename', '重新命名專案…'], ['save', '儲存', 'Ctrl+S'], ['saveAs', '另存新檔…', 'Ctrl+Shift+S'], ['collect', '收集專案…']]) {
        const button = document.createElement('button'), text = document.createElement('span'); text.textContent = label; button.append(text);
        if (keys) { const shortcut = document.createElement('span'); shortcut.className = 'shortcut'; shortcut.dataset.i18nSkip = ''; shortcut.textContent = keys; button.append(shortcut); }
        command(button, name); projectCommands.append(button);
    }
    fileMenu.prepend(projectCommands);
    const projectMenu = document.querySelectorAll('.app-menu')[1].querySelector('div');
    projectMenu.querySelector('[disabled]')?.remove();
    for (const [name, label] of [['save', '儲存專案'], ['saveAs', '另存新檔…'], ['collect', '收集專案…']]) {
        const button = document.createElement('button'); button.textContent = label; command(button, name); projectMenu.append(button);
    }
    const saveButton = $('.toolbar-actions button:nth-child(2)'); saveButton.textContent = '儲存專案'; command(saveButton, 'save');
    const openButton = $('.home-actions > button:nth-of-type(2)'); openButton.textContent = '開啟專案…'; command(openButton, 'open');
    if (controller) {
        $('#new-project').addEventListener('click', event => { event.stopImmediatePropagation(); controller.newProject(); }, true);
        document.addEventListener('keydown', event => {
            if (!event.ctrlKey || event.altKey || event.repeat || !['s', 'o'].includes(event.key.toLowerCase())) return;
            event.preventDefault(); if (event.key.toLowerCase() === 'o') controller.open(); else controller.save(event.shiftKey ? 'saveAs' : 'save');
        });
        const status = document.createElement('output'); status.id = 'project-status'; status.setAttribute('role', 'status'); $('.editor-strip > span').append(status);
        controller.subscribe(state => {
            status.textContent = state.name + '，' + (state.saving ? '儲存中' : state.dirty ? '未儲存' : '已儲存');
            status.dataset.dirty = String(state.dirty); status.title = state.projectPath || '尚未建立專案檔';
            if (!state.projectPath && !state.dirty && !state.saving) window.WaveCanvasI18nDom.text(status, '{name}，尚未存檔', { name: state.name });
            $('#shell-status').textContent = state.failure || (Object.keys(state.missingMedia).length ? window.WaveCanvasI18n.t('找不到素材：\n{list}', { list: Object.entries(state.missingMedia).map(([slot, ref]) => slot + ': ' + ref.path).join('\n') }) : '');
            for (const [slot, ref] of Object.entries(state.missingMedia)) {
                const label = $('#' + slot + '-name'); if (label) window.WaveCanvasI18nDom.text(label, '找不到檔案：{name}', { name: ref.name });
            }
            for (const button of document.querySelectorAll('[data-project-command]')) button.disabled = state.busy;
            $('#editor-view').inert = state.busy; $('#home-view').inert = state.busy;
            $('#new-project').firstChild.textContent = '新增專案 '; $('#new-project small').textContent = '從原廠預設開始';
        });
    }
    const recentRoot = $('.recent-projects');
    async function renderRecent() {
        const heading = document.createElement('h2'); heading.textContent = '最近使用';
        const list = controller ? await api.getRecent() : [];
        const nodes = [heading];
        if (!list.length) { const empty = document.createElement('p'); empty.textContent = controller ? '還沒有最近使用的專案。' : '專案功能需使用 Desktop App。'; nodes.push(empty); }
        for (const item of list) {
            const card = document.createElement('article'); card.className = 'recent-project-card';
            const image = document.createElement('img'); image.src = 'assets/templates/builtin_' + item.layout + '_default.png'; image.alt = item.layout;
            const content = document.createElement('div'), name = document.createElement('strong'), location = document.createElement('small'), date = document.createElement('small');
            name.textContent = item.name; location.textContent = item.path; location.title = item.path; name.dataset.i18nSkip = ''; location.dataset.i18nSkip = '';
            // 日期格式跟著介面語言；切換語言時整個清單會重新產生。
            window.WaveCanvasI18nDom.text(date, item.missing ? '找不到專案（{date}）' : '{date}', { date: new Date(item.lastOpenedAt).toLocaleString(window.WaveCanvasI18n.language()) });
            const action = document.createElement('button'); action.textContent = item.missing ? '從最近使用中移除' : '開啟';
            action.addEventListener('click', async () => { if (item.missing) { await api.removeRecent(item.path); await renderRecent(); } else await controller.open(item.path); });
            content.append(name, location, date, action); card.append(image, content); nodes.push(card);
        }
        recentRoot.replaceChildren(...nodes);
    }
    window.addEventListener('wavecanvas-language-change', () => renderRecent().catch(console.error));
    window.addEventListener('wavecanvas-recent-change', () => renderRecent().catch(error => { $('#shell-status').textContent = error.message; }));
    window.addEventListener('wavecanvas-view-change', () => { if (window.WaveCanvasShell.getView() === 'HOME') renderRecent().catch(console.error); });
    renderRecent().catch(console.error);
}());

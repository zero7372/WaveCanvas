(function () {
    'use strict';
    if (window.VisualizerRuntime.mode !== 'standalone') return;
    const preferences = window.WaveCanvasPreferences, schema = window.WaveCanvasAppSettings, ui = window.WaveCanvasDialogs;
    let active = false;
    const entry = ui.button('Preferences…'); entry.id = 'preferences-menu'; entry.disabled = !preferences.available; entry.title = preferences.available ? '' : 'Desktop App 功能';
    document.querySelector('.app-menu div').append(entry);
    async function show() {
        if (active || !preferences.available) return; active = true;
        await preferences.ready;
        const dialog = ui.create('Preferences'); dialog.id = 'preferences-dialog';
        const section = document.createElement('h3'); section.textContent = 'Project'; dialog.append(section);
        function checkbox(id, text) { const label = document.createElement('label'), input = document.createElement('input'); input.type = 'checkbox'; input.id = id; label.className = 'preference-toggle'; label.append(input, document.createTextNode(text)); dialog.append(label); return input; }
        const ask = checkbox('preference-ask-name', '建立新專案時要求輸入名稱'), enabled = checkbox('preference-autosave', '自動儲存');
        const label = document.createElement('label'), interval = document.createElement('select'); interval.id = 'preference-interval'; label.htmlFor = interval.id; label.textContent = '自動儲存間隔';
        for (const value of schema.intervals) { const option = document.createElement('option'); option.value = value; option.textContent = value + ' 分鐘'; interval.append(option); }
        const note = document.createElement('p'); note.className = 'dialog-note'; note.textContent = '只有已建立專案檔的專案才會自動儲存；每個專案保留最多 10 份備份。';
        const status = document.createElement('p'); status.className = 'dialog-message'; status.setAttribute('role', 'status');
        const actions = document.createElement('footer'), reset = ui.button('Restore Defaults'), cancel = ui.button('取消'), save = ui.button('儲存', 'primary-button'); save.id = 'preferences-save'; reset.id = 'preferences-reset';
        actions.append(reset, cancel, save); dialog.append(label, interval, note, status, actions);
        function display(value) { ask.checked = value.askNameOnCreate; enabled.checked = value.autosaveEnabled; interval.value = value.autosaveIntervalMinutes; interval.disabled = !enabled.checked; }
        display(preferences.get().project); enabled.onchange = () => interval.disabled = !enabled.checked;
        let saving = false;
        dialog.addEventListener('cancel', event => { if (saving) event.preventDefault(); }); cancel.onclick = () => dialog.close();
        reset.onclick = async () => { if (await ui.confirm('恢復 Preferences 預設值', '只恢復應用程式偏好設定。按儲存後才會套用。')) display(schema.defaults.project); };
        save.onclick = async () => {
            saving = true; save.disabled = cancel.disabled = reset.disabled = true; status.textContent = '';
            try { await preferences.update({ project: { askNameOnCreate: ask.checked, autosaveEnabled: enabled.checked, autosaveIntervalMinutes: Number(interval.value) } }); dialog.close(); }
            catch (error) { status.textContent = '無法儲存：' + error.message; }
            finally { saving = false; save.disabled = cancel.disabled = reset.disabled = false; }
        };
        dialog.addEventListener('close', () => { dialog.remove(); active = false; }, { once: true }); dialog.showModal(); ask.focus();
    }
    entry.onclick = () => show().catch(error => { active = false; document.querySelector('#shell-status').textContent = error.message; });
}());

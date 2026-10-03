(function () {
    'use strict';
    if (window.VisualizerRuntime.mode !== 'standalone') return;
    const preferences = window.WaveCanvasPreferences, schema = window.WaveCanvasAppSettings, ui = window.WaveCanvasDialogs, api = window.waveCanvas?.settings;
    let active = false;
    const entry = ui.button('Preferences…'); entry.id = 'preferences-menu'; entry.disabled = !preferences.available; entry.title = preferences.available ? '' : 'Desktop App 功能';
    document.querySelector('.app-menu div').append(entry);
    async function show() {
        if (active || !preferences.available) return; active = true; await preferences.ready;
        const dialog = ui.create('Preferences'); dialog.id = 'preferences-dialog';
        const body = document.createElement('div'), navigation = document.createElement('nav'), panels = document.createElement('div'); body.className = 'preferences-body'; panels.className = 'preferences-panels'; navigation.setAttribute('aria-label', 'Preferences 分類'); body.append(navigation, panels); dialog.append(body);
        const sections = {}, controls = {}; let first;
        for (const group of ['General','Project','Playback','Interface','Export','Advanced']) {
            const button = ui.button(group), section = document.createElement('section'), heading = document.createElement('h3'); section.id = 'preferences-' + group.toLowerCase(); heading.textContent = group; section.append(heading); sections[group] = section; panels.append(section); navigation.append(button);
            button.onclick = () => { for (const node of Object.values(sections)) node.hidden = node !== section; for (const node of navigation.children) node.setAttribute('aria-current', String(node === button)); };
            if (!first) first = button;
        }
        function field(group, key, id, labelText, choices) {
            const label = document.createElement('label'), input = document.createElement(choices ? 'select' : key === 'customDirectory' ? 'input' : 'input'); input.id = id; label.htmlFor = id; label.textContent = labelText;
            if (choices) for (const [value, text] of choices) { const option = document.createElement('option'); option.value = value; option.textContent = text; input.append(option); }
            else if (key === 'defaultVolume') { input.type = 'range'; input.min = 0; input.max = 100; input.step = 1; }
            else if (key === 'customDirectory') { input.type = 'text'; input.readOnly = true; input.placeholder = '尚未選擇資料夾'; }
            else { input.type = 'checkbox'; label.className = 'preference-toggle'; label.textContent = ''; label.append(input, document.createTextNode(labelText)); }
            if (input.type !== 'checkbox') label.append(input);
            sections[group].append(label); controls[group.toLowerCase() + '.' + key] = input; return input;
        }
        field('General','startupMode','preference-startup','啟動時', [['home','Home'],['reopen-last','Reopen Last Project']]);
        field('General','rememberWindowBounds','preference-window-bounds','記住視窗大小與位置');
        field('General','confirmUnsavedClose','preference-close-confirm','關閉未儲存專案前確認');
        field('Project','askNameOnCreate','preference-ask-name','建立新專案時要求輸入名稱');
        const enabled = field('Project','autosaveEnabled','preference-autosave','自動儲存');
        const interval = field('Project','autosaveIntervalMinutes','preference-interval','自動儲存間隔', schema.intervals.map(v => [v,v + ' 分鐘']));
        field('Project','recentProjectsLimit','preference-recent-limit','Recent Projects 數量', schema.recentLimits.map(v => [v,v]));
        const note = document.createElement('p'); note.className = 'dialog-note'; note.textContent = '只有已建立專案檔的專案才會自動儲存；每個專案保留最多 10 份備份。'; sections.Project.append(note);
        const volume = field('Playback','defaultVolume','preference-volume','新播放工作階段的預設音量'), volumeValue = document.createElement('output'); volume.after(volumeValue); volume.oninput = () => volumeValue.textContent = volume.value + '%';
        field('Playback','autoPlayOnLoad','preference-autoplay','使用者載入音訊／專案後自動播放');
        const playbackNote = document.createElement('p'); playbackNote.className = 'dialog-note'; playbackNote.textContent = '啟動重開專案保持靜音；變更預設音量不覆蓋目前工作階段。'; sections.Playback.append(playbackNote);
        field('Interface','uiScale','preference-ui-scale','介面大小', schema.scales.map(v => [v,Math.round(v * 100) + '%']));
        field('Export','defaultDirectoryMode','preference-export-mode','預設輸出位置', [['last-used','Last used folder'],['project-folder','Project folder'],['custom','Custom folder']]);
        const folder = field('Export','customDirectory','preference-export-directory','自訂資料夾'), choose = ui.button('Choose Folder'); choose.id = 'preference-choose-directory'; sections.Export.append(choose);
        const data = ui.button('Open WaveCanvas Data Folder'); data.id = 'preference-open-data'; sections.Advanced.append(data);
        const advancedNote = document.createElement('p'); advancedNote.className = 'dialog-note'; advancedNote.textContent = 'Restore Defaults 只恢復偏好設定；保留 Recent Projects、視窗與匯出位置紀錄及備份。'; sections.Advanced.append(advancedNote);
        const status = document.createElement('p'); status.className = 'dialog-message'; status.setAttribute('role','status');
        const actions = document.createElement('footer'), reset = ui.button('Restore Defaults'), cancel = ui.button('取消'), save = ui.button('儲存','primary-button'); save.id = 'preferences-save'; reset.id = 'preferences-reset'; actions.append(reset,cancel,save); dialog.append(status,actions);
        function display(value) { for (const [name,input] of Object.entries(controls)) { const [group,key] = name.split('.'), v = value[group][key]; if (input.type === 'checkbox') input.checked = v; else input.value = key === 'defaultVolume' ? Math.round(v * 100) : v ?? ''; } interval.disabled = !enabled.checked; volume.oninput(); }
        display(preferences.get()); enabled.onchange = () => interval.disabled = !enabled.checked;
        let saving = false, restoringDefaults = false;
        function lock(value) { saving = value; for (const input of [save,cancel,reset,choose,data]) input.disabled = value; }
        dialog.addEventListener('cancel', event => { if (saving) event.preventDefault(); }); cancel.onclick = () => dialog.close();
        reset.onclick = async () => { if (await ui.confirm('恢復 Preferences 預設值','只恢復應用程式偏好設定。按儲存後才會套用。')) { display(schema.defaults); restoringDefaults = true; } };
        choose.onclick = async () => { lock(true); try { const selected = await api.chooseDirectory(); if (selected) folder.value = selected; } catch (error) { status.textContent = error.message; } finally { lock(false); } };
        data.onclick = async () => { lock(true); try { await api.openDataFolder(); } catch (error) { status.textContent = error.message; } finally { lock(false); } };
        save.onclick = async () => {
            lock(true); status.textContent = ''; const changes = {};
            for (const [name,input] of Object.entries(controls)) { const [group,key] = name.split('.'); changes[group] ||= {}; changes[group][key] = input.type === 'checkbox' ? input.checked : ['autosaveIntervalMinutes','recentProjectsLimit','uiScale'].includes(key) ? Number(input.value) : key === 'defaultVolume' ? Number(input.value) / 100 : key === 'customDirectory' ? input.value || null : input.value; }
            try { await preferences.update(changes, restoringDefaults); dialog.close(); } catch (error) { status.textContent = '無法儲存：' + error.message; } finally { lock(false); }
        };
        dialog.addEventListener('close', () => { dialog.remove(); active = false; }, { once:true }); first.click(); dialog.showModal(); first.focus();
    }
    entry.onclick = () => show().catch(error => { active = false; document.querySelector('#shell-status').textContent = error.message; });
}());

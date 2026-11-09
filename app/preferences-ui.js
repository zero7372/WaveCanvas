(function () {
    'use strict';
    if (window.VisualizerRuntime.mode !== 'standalone') return;
    const preferences = window.WaveCanvasPreferences, schema = window.WaveCanvasAppSettings, ui = window.WaveCanvasDialogs, api = window.waveCanvas?.settings;
    let active = false;
    const entry = ui.button('偏好設定…'); entry.id = 'preferences-menu'; entry.disabled = !preferences.available; entry.title = preferences.available ? '' : 'Desktop App 功能';
    document.querySelector('.app-menu div').append(entry);
    async function show() {
        if (active || !preferences.available) return; active = true; await preferences.ready;
        const dialog = ui.create('偏好設定'); dialog.id = 'preferences-dialog';
        const body = document.createElement('div'), navigation = document.createElement('nav'), panels = document.createElement('div'); body.className = 'preferences-body'; panels.className = 'preferences-panels'; navigation.setAttribute('aria-label', 'Preferences 分類'); body.append(navigation, panels); dialog.append(body);
        const sections = {}, controls = {}; let first;
        for (const group of ['General','Project','Playback','Interface','Export','Advanced']) {
            const name = { General: '一般', Project: '專案', Playback: '播放', Interface: '介面', Export: '輸出', Advanced: '進階' }[group];
            const button = ui.button(name), section = document.createElement('section'), heading = document.createElement('h3'); section.id = 'preferences-' + group.toLowerCase(); heading.textContent = name; section.append(heading); sections[group] = section; panels.append(section); navigation.append(button);
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
        field('General','startupMode','preference-startup','啟動時', [['home','顯示首頁'],['reopen-last','開啟上次的專案']]);
        field('General','rememberWindowBounds','preference-window-bounds','記住視窗大小與位置');
        field('General','confirmUnsavedClose','preference-close-confirm','關閉未儲存專案前確認');
        field('Project','askNameOnCreate','preference-ask-name','建立新專案時要求輸入名稱');
        const enabled = field('Project','autosaveEnabled','preference-autosave','自動儲存');
        const interval = field('Project','autosaveIntervalMinutes','preference-interval','自動儲存間隔', schema.intervals.map(v => [v,window.WaveCanvasI18n.t('{count} 分鐘', { count: v })]));
        field('Project','recentProjectsLimit','preference-recent-limit','最近使用的專案數量', schema.recentLimits.map(v => [v,v]));
        const note = document.createElement('p'); note.className = 'dialog-note'; note.textContent = '只有已建立專案檔的專案才會自動儲存；每個專案保留最多 10 份備份。'; sections.Project.append(note);
        const volume = field('Playback','defaultVolume','preference-volume','預設音量'), volumeValue = document.createElement('output'); volume.after(volumeValue); volume.oninput = () => volumeValue.textContent = volume.value + '%';
        field('Playback','autoPlayOnLoad','preference-autoplay','載入音訊或專案後自動播放');
        const playbackNote = document.createElement('p'); playbackNote.className = 'dialog-note'; playbackNote.textContent = '啟動時重新開啟專案不會自動播放；變更預設音量不影響正在播放的內容。'; sections.Playback.append(playbackNote);
        field('Interface','uiScale','preference-ui-scale','介面大小', schema.scales.map(v => [v,Math.round(v * 100) + '%']));
        // 語言名稱一律用該語言本身書寫，不跟著介面翻譯。
        const languageSelect = field('Interface','language','preference-language','語言', [['system','跟隨系統'],['zh-TW','繁體中文'],['en','English'],['ja','日本語']]);
        for (const option of languageSelect.options) if (option.value !== 'system') option.dataset.i18nSkip = '';
        const languageNote = document.createElement('p'); languageNote.className = 'dialog-note'; languageNote.textContent = 'English 與日本語為翻譯草稿。切換語言不影響專案內容與輸出結果。'; sections.Interface.append(languageNote);
        field('Export','defaultDirectoryMode','preference-export-mode','預設輸出位置', [['last-used','上次使用的資料夾'],['project-folder','專案所在資料夾'],['custom','自訂資料夾']]);
        const folder = field('Export','customDirectory','preference-export-directory','自訂資料夾'), choose = ui.button('選擇資料夾'); choose.id = 'preference-choose-directory'; sections.Export.append(choose);
        const data = ui.button('開啟資料資料夾'); data.id = 'preference-open-data'; sections.Advanced.append(data);
        const advancedNote = document.createElement('p'); advancedNote.className = 'dialog-note'; advancedNote.textContent = '恢復預設值只影響偏好設定；最近使用的專案、視窗與輸出位置紀錄、備份都會保留。'; sections.Advanced.append(advancedNote);
        const status = document.createElement('p'); status.className = 'dialog-message'; status.setAttribute('role','status');
        const actions = document.createElement('footer'), reset = ui.button('恢復預設值'), cancel = ui.button('取消'), save = ui.button('儲存','primary-button'); save.id = 'preferences-save'; reset.id = 'preferences-reset'; actions.append(reset,cancel,save); dialog.append(status,actions);
        function display(value) { for (const [name,input] of Object.entries(controls)) { const [group,key] = name.split('.'), v = value[group][key]; if (input.type === 'checkbox') input.checked = v; else input.value = key === 'defaultVolume' ? Math.round(v * 100) : v ?? ''; } interval.disabled = !enabled.checked; volume.oninput(); }
        display(preferences.get()); enabled.onchange = () => interval.disabled = !enabled.checked;
        let saving = false, restoringDefaults = false;
        function lock(value) { saving = value; for (const input of [save,cancel,reset,choose,data]) input.disabled = value; }
        dialog.addEventListener('cancel', event => { if (saving) event.preventDefault(); }); cancel.onclick = () => dialog.close();
        reset.onclick = async () => { if (await ui.confirm('恢復偏好設定預設值','只恢復應用程式偏好設定。按儲存後才會套用。')) { display(schema.defaults); restoringDefaults = true; } };
        choose.onclick = async () => { lock(true); try { const selected = await api.chooseDirectory(); if (selected) folder.value = selected; } catch (error) { status.textContent = error.message; } finally { lock(false); } };
        data.onclick = async () => { lock(true); try { await api.openDataFolder(); } catch (error) { status.textContent = error.message; } finally { lock(false); } };
        save.onclick = async () => {
            lock(true); status.textContent = ''; const changes = {};
            for (const [name,input] of Object.entries(controls)) { const [group,key] = name.split('.'); changes[group] ||= {}; changes[group][key] = input.type === 'checkbox' ? input.checked : ['autosaveIntervalMinutes','recentProjectsLimit','uiScale'].includes(key) ? Number(input.value) : key === 'defaultVolume' ? Number(input.value) / 100 : key === 'customDirectory' ? input.value || null : input.value; }
            try { await preferences.update(changes, restoringDefaults); dialog.close(); } catch (error) { status.textContent = window.WaveCanvasI18n.t('無法儲存：{message}', { message: error.message }); } finally { lock(false); }
        };
        dialog.addEventListener('close', () => { dialog.remove(); active = false; }, { once:true }); first.click(); dialog.showModal(); first.focus();
    }
    entry.onclick = () => show().catch(error => { active = false; document.querySelector('#shell-status').textContent = error.message; });
}());

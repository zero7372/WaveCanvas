(function () {
    'use strict';
    // 啟動後在背景檢查新版；有新版時在右下角顯示提示，不阻擋操作，也不自動下載。
    const api = window.waveCanvas?.update, preferences = window.WaveCanvasPreferences;
    if (!api || !preferences?.available) return;
    const D = window.WaveCanvasI18nDom;
    const STARTUP_DELAY_MS = 3000;
    function button(text, action, className = '') {
        const node = document.createElement('button'); node.type = 'button'; node.textContent = text; node.className = className; node.onclick = action; return node;
    }
    function notice(result) {
        document.querySelector('#update-notice')?.remove();
        const box = document.createElement('div'); box.id = 'update-notice'; box.setAttribute('role', 'status');
        const message = document.createElement('p'); D.text(message, '有新版本 {version} 可以下載（目前 {current}）。', { version: result.version, current: result.current });
        const close = () => box.remove();
        const actions = document.createElement('div');
        actions.append(button('查看新版本', () => { api.openRelease().catch(error => console.warn('Update:', error.message)); close(); }, 'primary-button'),
            button('略過此版本', () => { api.skip(result.version).catch(error => console.warn('Update:', error.message)); close(); }),
            button('關閉', close));
        box.append(message, actions); document.body.append(box);
    }
    // manual：偏好設定裡的「檢查更新」，結果寫在狀態欄位；自動檢查失敗時不顯示任何訊息。
    async function check(manual = false, status = null) {
        let result;
        try { result = await api.check(manual); } catch (error) { result = { status: 'error', message: error.message }; }
        if (result.status === 'available') notice(result);
        if (status) {
            if (result.status === 'available') D.text(status, '有新版本 {version}。', { version: result.version });
            else if (result.status === 'current') D.text(status, '已是最新版本（{version}）。', { version: result.version });
            else D.text(status, '無法檢查更新，請稍後再試。');
        }
        return result;
    }
    preferences.ready.then(() => {
        if (preferences.get().general.checkForUpdates) setTimeout(() => check(false), STARTUP_DELAY_MS);
    });
    window.WaveCanvasUpdates = Object.freeze({ check });
}());

(function () {
    'use strict';
    const api = window.waveCanvas?.release;
    if (!api) return;
    const menu = document.querySelectorAll('.app-menu')[4]?.querySelector('div');
    if (!menu) return;
    function button(text, action, primary) {
        const node = document.createElement('button'); node.type = 'button'; node.textContent = text; node.onclick = action;
        if (primary) node.className = 'primary-button';
        return node;
    }
    async function show(licenses) {
        try {
            const info = await api.read();
            const dialog = document.createElement('dialog'); dialog.id = 'release-dialog'; dialog.className = 'app-dialog';
            const heading = document.createElement('h2'); heading.textContent = licenses ? '第三方授權' : '關於 ' + info.name;
            const summary = document.createElement('p'); summary.className = 'dialog-note'; summary.style.whiteSpace = 'pre-line';
            summary.textContent = licenses
                ? 'WaveCanvas 以 MIT 授權發布，並保留原作者的著作權聲明。\n隨附的 FFmpeg 與 libx264 採用 GPLv3 或更新版本，對應原始碼隨安裝檔一併提供（見 SOURCE_INFO）。\n介面執行環境為 Electron 與 Chromium。'
                : info.name + ' ' + info.version + '\nMIT 授權，保留原作者的著作權聲明。\n隨附的 FFmpeg 與 libx264 採用 GPLv3 或更新版本。';
            dialog.append(heading, summary);
            if (licenses) for (const resource of info.documents) {
                const details = document.createElement('details'), title = document.createElement('summary'), text = document.createElement('pre');
                title.textContent = resource.name; text.textContent = resource.text;
                text.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;max-height:40vh;overflow:auto';
                details.append(title, text); dialog.append(details);
            }
            const footer = document.createElement('footer');
            if (licenses) footer.append(
                button('Chromium 授權聲明', () => api.openChromiumNotices().catch(error => alert(error.message))),
                button('開啟授權資料夾', () => api.openLicenses().catch(error => alert(error.message))));
            else footer.append(button('第三方授權', () => { dialog.close(); show(true); }));
            footer.append(button('關閉', () => dialog.close(), true));
            dialog.append(footer);
            if (licenses) dialog.style.width = 'min(760px, calc(100vw - 48px))';
            dialog.addEventListener('close', () => dialog.remove()); document.body.append(dialog); dialog.showModal();
        } catch (error) { alert('無法讀取授權資訊：' + error.message); }
    }
    for (const [label, licenses] of [['關於 WaveCanvas', false], ['第三方授權', true]]) {
        const node = document.createElement('button'); node.textContent = label; node.onclick = () => { menu.parentElement.open = false; show(licenses); }; menu.append(node);
    }
}());

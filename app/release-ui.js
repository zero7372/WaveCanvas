(function () {
    'use strict';
    const api = window.waveCanvas?.release;
    if (!api) return;
    const menu = document.querySelectorAll('.app-menu')[4]?.querySelector('div');
    if (!menu) return;
    async function show(licenses) {
        try {
            const info = await api.read();
            const dialog = document.createElement('dialog'); dialog.id = 'release-dialog';
            dialog.style.cssText = 'max-width:800px;width:80vw;max-height:80vh;background:#20232b;color:#eee;border:1px solid #555;padding:24px';
            const heading = document.createElement('h2'); heading.textContent = licenses ? 'Open Source Licenses' : 'About ' + info.name;
            const summary = document.createElement('p'); summary.textContent = info.name + ' ' + info.version + ' — Unsigned Release Candidate\nMIT; original copyright attribution retained in WaveCanvas-LICENSE.txt.\nBundled FFmpeg / libx264: GPLv3-or-later. Corresponding source delivery incomplete; public release blocked.';
            summary.style.whiteSpace = 'pre-line'; dialog.append(heading, summary);
            if (licenses) for (const resource of info.documents) {
                const details = document.createElement('details'), title = document.createElement('summary'), text = document.createElement('pre');
                title.textContent = resource.name; text.textContent = resource.text; text.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px'; details.append(title, text); dialog.append(details);
            }
            const open = document.createElement('button'); open.textContent = licenses ? 'Open Licenses Folder' : 'Open Source Licenses';
            open.onclick = () => licenses ? api.openLicenses().catch(error => alert(error.message)) : (dialog.close(), show(true));
            const close = document.createElement('button'); close.textContent = 'Close'; close.onclick = () => dialog.close();
            dialog.append(open, close); dialog.addEventListener('close', () => dialog.remove()); document.body.append(dialog); dialog.showModal();
        } catch (error) { alert('Licenses: ' + error.message); }
    }
    for (const [label, licenses] of [['About WaveCanvas', false], ['Open Source Licenses', true]]) {
        const button = document.createElement('button'); button.textContent = label; button.onclick = () => { menu.parentElement.open = false; show(licenses); }; menu.append(button);
    }
}());

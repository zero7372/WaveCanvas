'use strict';
const { BrowserWindow } = require('electron'), path = require('node:path');
async function create() {
    const window = new BrowserWindow({ width: 1920, height: 1080, useContentSize: true, show: false, frame: false, backgroundColor: '#000000',
        webPreferences: { preload: path.join(__dirname, 'export-preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false,
            offscreen: { useSharedTexture: false, deviceScaleFactor: 1 } } });
    const contents = window.webContents;
    window.setContentSize(1920, 1080);
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-navigate', event => event.preventDefault());
    let failed, rejectFailure;
    const failure = new Promise((_, reject) => { rejectFailure = reject; }); failure.catch(() => {});
    contents.on('render-process-gone', (_event, details) => { failed = Error('輸出 Renderer 停止：' + details.reason); rejectFailure(failed); });
    contents.on('console-message', details => { if (details.level === 'error') console.error('[Export Renderer]', details.message); });
    try { await window.loadFile(path.resolve(__dirname, '../app/export.html')); }
    catch (error) { window.destroy(); throw error; }
    contents.setZoomFactor(1);
    contents.setFrameRate(60);
    const execute = source => { if (failed) throw failed; return Promise.race([contents.executeJavaScript(source), failure]); };
    return { window, execute, async prepare() { return execute('exportData.read().then(payload=>WaveCanvasExportStage.prepare(payload))'); },
        // Optional marks are supplied only by the Main inspector benchmark helper.
        async capture(index, marks) {
            const result = await execute('WaveCanvasExportStage.renderAtFrame(' + index + ',' + Boolean(marks) + ')');
            if (marks) Object.assign(marks, result.marks, { paintWaitMs: 0, cropMs: 0, bitmapMs: 0 });
            const paint = () => new Promise((resolve, reject) => {
                const requested = marks ? performance.now() : 0;
                const painted = (_event, _rect, image) => {
                    if (marks) marks.paintWaitMs += performance.now() - requested;
                    clearTimeout(timer);
                    try {
                        const size = image.getSize();
                        if (size.width < 1920 || size.height < 1080) throw Error('Stage capture resolution 不正確：' + size.width + '×' + size.height);
                        // Crop Windows client rounding, then own the pixels while the paint
                        // callback is active; Chromium may recycle its surface afterwards.
                        const cropStarted = marks ? performance.now() : 0;
                        const stage = image.crop({ x: 0, y: 0, width: 1920, height: 1080 });
                        if (marks) marks.cropMs += performance.now() - cropStarted;
                        const bitmapStarted = marks ? performance.now() : 0;
                        const pixels = Buffer.from(stage.toBitmap());
                        if (marks) marks.bitmapMs += performance.now() - bitmapStarted;
                        resolve(pixels);
                    } catch (error) { reject(error); }
                };
                const timer = setTimeout(() => { contents.removeListener('paint', painted); reject(Error('等待 Stage compositor paint 逾時。')); }, 10000);
                contents.once('paint', painted); contents.invalidate();
            });
            // Drain an already queued paint, then invalidate once more at the same frozen time.
            await paint();
            const buffer = await paint();
            if (buffer.length !== 1920 * 1080 * 4) throw Error('Stage pixel buffer 長度不正確。');
            return buffer;
        }, dispose() { if (!window.isDestroyed()) window.destroy(); } };
}
module.exports = { create };

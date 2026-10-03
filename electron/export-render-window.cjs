'use strict';
const { BrowserWindow } = require('electron'), path = require('node:path');
const pixels = require('./export-pixels.cjs');

async function create() {
    // The last row authenticates a compositor commit; only the 1080 Stage rows are encoded.
    const window = new BrowserWindow({ width: 1920, height: 1081, useContentSize: true, show: false, frame: false, backgroundColor: '#000000',
        webPreferences: { preload: path.join(__dirname, 'export-preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false,
            backgroundThrottling: false, offscreen: { useSharedTexture: false, deviceScaleFactor: 1 } } });
    const contents = window.webContents;
    window.setContentSize(1920, 1081);
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-navigate', event => event.preventDefault());
    let failed, rejectFailure, pendingCancel, rowBuffer, capturing = false;
    const failure = new Promise((_, reject) => { rejectFailure = reject; }); failure.catch(() => {});
    const fail = error => { failed ||= error; pendingCancel?.(failed); rejectFailure(failed); };
    contents.on('render-process-gone', (_event, details) => fail(Error('輸出 Renderer 停止：' + details.reason)));
    contents.on('destroyed', () => fail(Error('輸出 Renderer 已關閉。')));
    contents.on('console-message', details => { if (details.level === 'error') console.error('[Export Renderer]', details.message); });
    try { await window.loadFile(path.resolve(__dirname, '../app/export.html')); }
    catch (error) { window.destroy(); throw error; }
    contents.setZoomFactor(1);
    // Native repaint cadence is independent of the deterministic 60 FPS content clock.
    contents.setFrameRate(240);
    const execute = source => {
        if (failed) throw failed;
        return Promise.race([contents.executeJavaScript(source), failure]);
    };
    return { window, execute, async prepare() {
        const info = await execute('exportData.read().then(payload=>WaveCanvasExportStage.prepare(payload))');
        await execute('WaveCanvasExportStage.configureCapture()');
        return info;
    }, async capture(index, marks) {
        if (failed) throw failed;
        if (capturing) throw Error('Export capture 必須逐幀等待。');
        capturing = true;
        if (marks) Object.assign(marks, { paintWaitMs: 0, cropMs: 0, bitmapMs: 0, copyMs: 0, rejectedPaints: 0 });
        let received, renderFinished;
        const pending = new Promise((resolve, reject) => {
            const cleanup = () => { clearTimeout(timer); contents.removeListener('paint', painted); pendingCancel = null; };
            pendingCancel = error => { cleanup(); reject(error); };
            const painted = (_event, _rect, image) => {
                try {
                    const arrived = performance.now(), size = image.getSize();
                    const tick = marks ? performance.now() : 0;
                    // Electron's supported toBitmap() API returns an owned copy of the surface.
                    const bitmap = image.toBitmap();
                    if (marks) { marks.bitmapMs += performance.now() - tick; marks.surfaceWidth = size.width; marks.surfaceHeight = size.height; }
                    pixels.validate(bitmap, size.width, size.height);
                    if (!pixels.matchesFrame(bitmap, size.width, index)) {
                        if (marks) marks.rejectedPaints++;
                        return;
                    }
                    received = arrived;
                    const cropStarted = marks ? performance.now() : 0;
                    // Queue depth stays one: stdin's callback precedes reuse of the row buffer.
                    const frame = pixels.stage(bitmap, size.width, rowBuffer);
                    if (size.width !== pixels.WIDTH) rowBuffer = frame;
                    if (marks) marks.cropMs = performance.now() - cropStarted;
                    cleanup(); resolve(frame);
                } catch (error) { cleanup(); reject(error); }
            };
            const timer = setTimeout(() => pendingCancel?.(Error('等待當前 Stage compositor frame 逾時。')), 10000);
            // Subscribe before advance. The changing metadata row always dirties the frame.
            contents.on('paint', painted);
        });
        pending.catch(() => {});
        try {
            const result = await execute('WaveCanvasExportStage.renderAtFrame(' + index + ',' + Boolean(marks) + ',0)');
            renderFinished = performance.now();
            if (marks) Object.assign(marks, result.marks);
            const frame = await Promise.race([pending, failure]);
            if (marks) marks.paintWaitMs = Math.max(0, received - renderFinished);
            return frame;
        } catch (error) { pendingCancel?.(error); throw error; }
        finally { capturing = false; }
    }, dispose() {
        pendingCancel?.(Error('已停止 Stage capture。'));
        rowBuffer = null;
        if (!window.isDestroyed()) window.destroy();
    } };
}
module.exports = { create };

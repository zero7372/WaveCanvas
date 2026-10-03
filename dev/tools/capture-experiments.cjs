'use strict';
const { BrowserWindow } = require('electron'), path = require('node:path');
async function create(options = {}) {
    // Main-only experimental options; Renderer IPC cannot select capture behavior.
    const { rafCount = 2, nativeFrameRate = 60, singlePaint = false, discardReadback = true, copyBitmap = true, snapshot = false, sentinel = false, streamPaint = false } = options;
    if (![0, 1, 2].includes(rafCount) || ![60, 120, 240].includes(nativeFrameRate)) throw Error("Invalid capture test options");
    const window = new BrowserWindow({ width: 1920, height: sentinel ? 1081 : 1080, useContentSize: true, show: false, frame: false, backgroundColor: '#000000',
        webPreferences: { preload: path.resolve(__dirname, '../../electron/export-preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false,
            offscreen: { useSharedTexture: false, deviceScaleFactor: 1 } } });
    const contents = window.webContents;
    window.setContentSize(1920, sentinel ? 1081 : 1080);
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-navigate', event => event.preventDefault());
    let failed, rejectFailure;
    const failure = new Promise((_, reject) => { rejectFailure = reject; }); failure.catch(() => {});
    contents.on('render-process-gone', (_event, details) => { failed = Error('輸出 Renderer 停止：' + details.reason); rejectFailure(failed); });
    contents.on('console-message', details => { if (details.level === 'error') console.error('[Export Renderer]', details.message); });
    try { await window.loadFile(path.resolve(__dirname, '../../app/export.html')); }
    catch (error) { window.destroy(); throw error; }
    contents.setZoomFactor(1);
    contents.setFrameRate(nativeFrameRate);
    const execute = source => { if (failed) throw failed; return Promise.race([contents.executeJavaScript(source), failure]); };
    let rowBuffer;
    return { window, execute, async prepare() {
        const info = await execute('exportData.read().then(payload=>WaveCanvasExportStage.prepare(payload))');
        if (sentinel) await execute('WaveCanvasExportStage.configureCapture()');
        return info;
    },
        // Optional marks are supplied only by the Main inspector benchmark helper.
        async capture(index, marks) {
            if (marks) Object.assign(marks, { paintWaitMs: 0, cropMs: 0, bitmapMs: 0, copyMs: 0 });
            const captureSentinel = () => new Promise((resolve, reject) => {
                const requested = performance.now();
                if (marks) marks.rejectedPaints = 0;
                const cleanup = () => { clearTimeout(timer); contents.removeListener('paint', painted); };
                const painted = (_event, _rect, image) => {
                    try {
                        const size = image.getSize();
                        if (size.width < 1920 || size.height < 1081) throw Error('Stage sentinel surface resolution 不正確。');
                        const tick = marks ? performance.now() : 0;
                        const bitmap = image.toBitmap();
                        if (marks) { marks.bitmapMs += performance.now() - tick; marks.surfaceWidth = size.width; marks.surfaceHeight = size.height; }
                        const marker = 1080 * size.width * 4, value = index + 1;
                        const rgb = [value & 255, (value >>> 8) & 255, (value >>> 16) & 255];
                        if (rgb.some((v, channel) => bitmap[marker + 2 - channel] !== v || bitmap[marker + 6 - channel] !== 255 - v)) {
                            if (marks) marks.rejectedPaints++;
                            return;
                        }
                        if (marks) marks.paintWaitMs = performance.now() - requested;
                        const cropStarted = marks ? performance.now() : 0;
                        let pixels;
                        if (size.width === 1920) pixels = bitmap.subarray(0, 1920 * 1080 * 4);
                        else {
                            // The controller awaits stdin's write callback before another capture.
                            rowBuffer ||= Buffer.allocUnsafe(1920 * 1080 * 4);
                            for (let y = 0; y < 1080; y++) bitmap.copy(rowBuffer, y * 1920 * 4, y * size.width * 4, y * size.width * 4 + 1920 * 4);
                            pixels = rowBuffer;
                        }
                        if (marks) marks.cropMs = performance.now() - cropStarted;
                        cleanup(); resolve(pixels);
                    } catch (error) { cleanup(); reject(error); }
                };
                const timer = setTimeout(() => { cleanup(); reject(Error('等待當前 Stage compositor frame 逾時。')); }, 10000);
                contents.on('paint', painted); if (!streamPaint) contents.invalidate();
            });
            if (sentinel && streamPaint) {
                // Subscribe before advancing virtual time; the metadata mutation guarantees a new paint.
                const pending = captureSentinel();
                pending.catch(() => {});
                const result = await execute('WaveCanvasExportStage.renderAtFrame(' + index + ',' + Boolean(marks) + ',' + rafCount + ')');
                if (marks) Object.assign(marks, result.marks);
                return pending;
            }
            const result = await execute('WaveCanvasExportStage.renderAtFrame(' + index + ',' + Boolean(marks) + ',' + rafCount + ')');
            if (marks) Object.assign(marks, result.marks, { paintWaitMs: 0, cropMs: 0, bitmapMs: 0, copyMs: 0 });
            if (sentinel) return captureSentinel();
            if (snapshot) {
                const requested = marks ? performance.now() : 0;
                const image = await contents.capturePage({ x: 0, y: 0, width: 1920, height: 1080 }, { stayHidden: true, stayAwake: true });
                if (marks) marks.paintWaitMs = performance.now() - requested;
                const size = image.getSize();
                if (size.width !== 1920 || size.height !== 1080) throw Error('Stage snapshot resolution 不正確。');
                const tick = marks ? performance.now() : 0;
                const pixels = image.toBitmap();
                if (marks) marks.bitmapMs = performance.now() - tick;
                if (pixels.length !== 1920 * 1080 * 4) throw Error('Stage snapshot buffer 長度不正確。');
                return pixels;
            }
            const paint = (label, readback) => new Promise((resolve, reject) => {
                const requested = marks ? performance.now() : 0;
                const painted = (_event, _rect, image) => {
                    const received = marks ? performance.now() : 0;
                    if (marks) {
                        marks[label + 'PaintWaitMs'] = received - requested;
                        marks.paintWaitMs += received - requested;
                        marks[label + 'CropMs'] = marks[label + 'BitmapMs'] = marks[label + 'CopyMs'] = 0;
                    }
                    clearTimeout(timer);
                    try {
                        if (!readback) { resolve(null); return; }
                        const size = image.getSize();
                        if (marks) { marks.surfaceWidth = size.width; marks.surfaceHeight = size.height; }
                        if (size.width < 1920 || size.height < 1080) throw Error('Stage capture resolution 不正確：' + size.width + '×' + size.height);
                        let tick = marks ? performance.now() : 0;
                        const stage = image.crop({ x: 0, y: 0, width: 1920, height: 1080 });
                        if (marks) { marks[label + 'CropMs'] = performance.now() - tick; marks.cropMs += marks[label + 'CropMs']; tick = performance.now(); }
                        // Electron documents toBitmap() as an independent copy, not a surface view.
                        const bitmap = stage.toBitmap();
                        if (marks) { marks[label + 'BitmapMs'] = performance.now() - tick; marks.bitmapMs += marks[label + 'BitmapMs']; tick = performance.now(); }
                        const pixels = copyBitmap ? Buffer.from(bitmap) : bitmap;
                        if (marks) { marks[label + 'CopyMs'] = performance.now() - tick; marks.copyMs += marks[label + 'CopyMs']; }
                        resolve(pixels);
                    } catch (error) { reject(error); }
                };
                const timer = setTimeout(() => { contents.removeListener('paint', painted); reject(Error('等待 Stage compositor paint 逾時。')); }, 10000);
                contents.once('paint', painted);
                const invalidationStarted = marks ? performance.now() : 0;
                contents.invalidate();
                if (marks) marks[label + 'InvalidateMs'] = performance.now() - invalidationStarted;
            });
            let buffer;
            if (singlePaint) buffer = await paint('first', true);
            else {
                await paint('first', discardReadback);
                buffer = await paint('second', true);
            }
            if (buffer.length !== 1920 * 1080 * 4) throw Error('Stage pixel buffer 長度不正確。');
            return buffer;
        }, dispose() { if (!window.isDestroyed()) window.destroy(); } };
}
module.exports = { create };

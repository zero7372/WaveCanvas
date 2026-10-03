'use strict';
const { app, ipcMain, dialog, shell } = require('electron');
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os');
const model = require('../app/project-model.js'), ffmpeg = require('./ffmpeg-runner.cjs'), render = require('./export-render-window.cjs');
function install(editor) {
    const prefix = 'wavecanvas-export:'; let job = null, selected = null, completedPath = null;
    function send(value) { if (!editor.isDestroyed()) editor.webContents.send(prefix + 'progress', value); }
    function bind(name, handler) { ipcMain.handle(prefix + name, async (event, ...args) => {
        if (event.sender !== editor.webContents || event.senderFrame !== editor.webContents.mainFrame) throw Error('Export IPC sender 無效。');
        return handler(...args);
    }); }
    bind('selectOutput', async name => {
        if (job) throw Error('輸出進行中。');
        const safe = String(name || 'WaveCanvas Export').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 150);
        const choice = await dialog.showSaveDialog(editor, { title: '輸出影片', defaultPath: safe + '.mp4', filters: [{ name: 'MP4 Video', extensions: ['mp4'] }] });
        selected = choice.canceled ? null : choice.filePath;
        if (selected && !/\.mp4$/i.test(selected)) selected += '.mp4'; return Boolean(selected);
    });
    ipcMain.handle(prefix + 'payload', event => {
        if (!job?.renderer || event.sender !== job.renderer.window.webContents || event.senderFrame !== event.sender.mainFrame) throw Error('Export payload sender 無效。');
        return job.payload;
    });
    async function start(payload, range) {
        if (job || !selected) throw Error('請先選擇輸出位置。');
        const snapshot = model.validate(payload.snapshot), assets = {};
        if (Buffer.byteLength(JSON.stringify(snapshot)) > 16 * 1024 * 1024) throw Error('輸出 snapshot 過大。');
        let total = 0;
        for (const slot of ['audio', 'cover', 'background', 'overlay']) {
            const asset = payload.assets?.[slot]; if (!asset) continue;
            if (!(asset.bytes instanceof Uint8Array) || asset.bytes.byteLength > (slot === 'audio' ? 1024 : 100) * 1024 * 1024) throw Error('輸出素材無效或過大。');
            assets[slot] = { bytes: asset.bytes, name: String(asset.name || slot).slice(0, 200) }; total += asset.bytes.byteLength;
        }
        if (!assets.audio || total > 1200 * 1024 * 1024) throw Error('請先載入有效音訊。');
        const state = { canceled: false, payload: { snapshot, assets }, output: selected, temp: ffmpeg.temporary(selected), renderer: null, runner: null };
        const aborted = new Promise((_, reject) => { state.abort = reject; }); aborted.catch(() => {});
        const waiting = promise => Promise.race([promise, aborted]);
        selected = null; job = state;
        const started = performance.now(); let directory;
        const check = () => { if (state.canceled || editor.isDestroyed()) throw Error('已取消影片輸出。'); };
        try {
            await fs.access(ffmpeg.resolver(app)).catch(() => { throw Error('找不到 FFmpeg runtime，請確認 Desktop App 的 resources/ffmpeg 完整。'); }); check();
            directory = await fs.mkdtemp(path.join(os.tmpdir(), 'wavecanvas-export-'));
            const extension = /\.(wav|mp3|flac|m4a|aac|ogg|opus|aiff|aif|webm)$/i.exec(assets.audio.name)?.[0] || '.audio';
            const audio = path.join(directory, 'source' + extension); await fs.writeFile(audio, assets.audio.bytes); check();
            send({ phase: 'preparing', progress: 0 }); state.renderer = await render.create(); check();
            const info = await waiting(state.renderer.prepare()); check();
            const from = range?.startTime ?? 0, until = range?.endTime ?? info.duration;
            if (!Number.isFinite(from) || !Number.isFinite(until) || from < 0 || until <= from || until > info.duration) throw Error('測試 range 無效。');
            const first = Math.round(from * 60), count = ffmpeg.frames(until - from);
            state.runner = ffmpeg.run(ffmpeg.resolver(app), ffmpeg.args(audio, state.temp, count, from));
            let sumMs = 0, slowestMs = 0;
            const rawFrameHashes = {};
            const diagnosticStates = {};
            const allFrameHashes = [];
            let peakWorkingSetBytes = 0;
            const memory = () => { peakWorkingSetBytes = Math.max(peakWorkingSetBytes, app.getAppMetrics().reduce((sum, entry) => sum + (entry.memory?.workingSetSize || 0) * 1024, 0)); };
            memory();
            const encodeStarted = performance.now();
            for (let index = 0; index < first + count; index++) {
                check(); const captureStarted = performance.now();
                const frame = await waiting(state.renderer.capture(index)); check();
                if (index < first) continue;
                if (editor.exportTestDiagnostics) allFrameHashes.push(require('node:crypto').createHash('sha256').update(frame).digest('hex'));
                if ([first, first + 60, first + 120].includes(index)) rawFrameHashes[index] = require('node:crypto').createHash('sha256').update(frame).digest('hex');
                if (editor.exportTestDiagnostics && [first, first + 60, first + 120].includes(index)) {
                    diagnosticStates[index] = await state.renderer.execute('({samples:audioSample.slice(),background:document.querySelector("#bgimg").style.cssText,lyrics:document.querySelector("#lyrics-stack").innerHTML,canvas:document.querySelector("#canvas").toDataURL()})');
                    diagnosticStates[index].composite = require('electron').nativeImage.createFromBitmap(frame, { width: 1920, height: 1080 }).toPNG().toString('base64');
                }
                const elapsed = performance.now() - captureStarted; sumMs += elapsed; slowestMs = Math.max(slowestMs, elapsed);
                await state.runner.write(frame); check();
                if (index % 12 === 0 || index === first + count - 1) { memory(); send({ phase: 'rendering', progress: 5 + 90 * (index - first + 1) / count, frame: index - first + 1, totalFrames: count }); }
            }
            const renderingMs = performance.now() - encodeStarted, finalEncodeStarted = performance.now();
            send({ phase: 'encoding', progress: 95 }); state.runner.end(); await state.runner.completed; check();
            state.committing = true;
            send({ phase: 'finalizing', progress: 98 }); await fs.rename(state.temp, state.output);
            completedPath = state.output;
            const result = { output: state.output, duration: info.duration, exportedDuration: count / 60, frames: count, averageCaptureMs: sumMs / count,
                slowestCaptureMs: slowestMs, analysisMs: info.analysisMs, cacheBytes: info.cacheBytes, encodingMs: performance.now() - encodeStarted,
                renderingMs, encoderDrainMs: performance.now() - finalEncodeStarted, peakWorkingSetBytes,
                totalMs: performance.now() - started, droppedFrames: 0, peakQueueDepth: 1, rawFrameHashes, allFrameHashes, diagnosticStates, bytes: (await fs.stat(state.output)).size };
            send({ phase: 'complete', progress: 100, result }); return result;
        } catch (error) { send({ phase: state.canceled ? 'canceled' : 'error', error: state.canceled ? '已取消影片輸出。' : '影片輸出失敗：' + error.message }); throw error; }
        finally {
            await state.runner?.stop(); state.renderer?.dispose();
            await fs.rm(state.temp, { force: true }).catch(error => console.error('[Export cleanup]', error.message));
            if (directory && path.dirname(path.resolve(directory)) === path.resolve(os.tmpdir()) && path.basename(directory).startsWith('wavecanvas-export-')) {
                await fs.rm(directory, { recursive: true, force: true }).catch(error => console.error('[Export cleanup]', error.message));
            }
            job = null;
        }
    }
    // Range is an internal Main-side test helper; the Renderer IPC always exports the full song.
    bind('start', payload => start(payload));
    bind('cancel', async () => { if (job?.committing) return false; if (job) { job.canceled = true; job.abort(Error('已取消影片輸出。')); await job.runner?.stop(); } return true; });
    bind('reveal', () => { if (completedPath) shell.showItemInFolder(completedPath); });
    editor.on('closed', () => { if (job) { job.canceled = true; job.abort(Error('已關閉主視窗。')); job.runner?.stop(); } for (const name of ['selectOutput', 'payload', 'start', 'cancel', 'reveal']) ipcMain.removeHandler(prefix + name); });
    return { startTest: (payload, output, range) => { selected = output; return start(payload, range); } };
}
module.exports = { install };

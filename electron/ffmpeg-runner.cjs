'use strict';
const { t } = require('../app/i18n.js');
const path = require('node:path'), { spawn } = require('node:child_process');
const fs = require('node:fs/promises'), crypto = require('node:crypto');
function resolver(app) { return path.join(app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '../vendor'), 'ffmpeg', 'ffmpeg.exe'); }
function temporary(output) { return path.join(path.dirname(output), '.' + path.basename(output) + '.' + crypto.randomUUID() + '.partial.mp4'); }
const formats = require('../app/export-format.js');
// format 省略時就是 1.1 的 1080p／60 fps／medium，參數與舊版完全相同。
function args(audio, output, count, start = 0, padAudio = false, format = formats.resolve()) {
    const scale = format.width === format.renderWidth ? [] : ['-vf', 'scale=' + format.width + ':' + format.height + ':flags=lanczos'];
    return ['-hide_banner', '-nostdin', '-y', '-f', 'rawvideo', '-pixel_format', 'bgra', '-video_size', format.renderWidth + 'x' + format.renderHeight, '-framerate', String(format.fps), '-i', 'pipe:0',
        '-ss', String(start), '-i', audio, '-map', '0:v:0', '-map', '1:a:0', ...scale, '-c:v', 'libx264', '-preset', format.preset, '-crf', '18', '-pix_fmt', 'yuv420p',
        '-frames:v', String(count), ...(padAudio ? ['-af', 'apad'] : []), '-c:a', 'aac', '-b:a', '320k', '-t', String(count / format.fps), '-movflags', '+faststart', output];
}
function run(binary, arguments_) {
    const child = spawn(binary, arguments_, { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
    let stderr = '', failure;
    child.stderr.on('data', data => { stderr = (stderr + data).slice(-16000); });
    child.stdin.on('error', error => { failure = error; });
    const completed = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', code => code === 0 ? resolve() : reject(Error(t('FFmpeg 編碼失敗：{detail}', { detail: stderr || failure?.message || code })))); });
    completed.catch(() => {});
    return { child, completed, async write(frame) {
        if (failure || child.exitCode !== null || child.stdin.destroyed) throw failure || Error(t('FFmpeg 已停止。'));
        await new Promise((resolve, reject) => child.stdin.write(frame, error => error ? reject(error) : resolve()));
    }, end() { child.stdin.end(); }, async stop() { child.kill(); await completed.catch(() => {}); } };
}
function frames(duration, tail = 0, fps = 60) { if (!Number.isFinite(duration) || duration <= 0 || duration > 21600) throw Error(t('音訊長度無效或超過六小時。')); return Math.ceil((duration + tail) * fps); }
module.exports = { resolver, temporary, args, run, frames };

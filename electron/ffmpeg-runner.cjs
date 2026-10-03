'use strict';
const path = require('node:path'), { spawn } = require('node:child_process');
const fs = require('node:fs/promises'), crypto = require('node:crypto');
function resolver(app) { return path.join(app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '../vendor'), 'ffmpeg', 'ffmpeg.exe'); }
function temporary(output) { return path.join(path.dirname(output), '.' + path.basename(output) + '.' + crypto.randomUUID() + '.partial.mp4'); }
function args(audio, output, count, start = 0) {
    return ['-hide_banner', '-nostdin', '-y', '-f', 'rawvideo', '-pixel_format', 'bgra', '-video_size', '1920x1080', '-framerate', '60', '-i', 'pipe:0',
        '-ss', String(start), '-i', audio, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
        '-frames:v', String(count), '-c:a', 'aac', '-b:a', '320k', '-t', String(count / 60), '-movflags', '+faststart', output];
}
function run(binary, arguments_) {
    const child = spawn(binary, arguments_, { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
    let stderr = '', failure;
    child.stderr.on('data', data => { stderr = (stderr + data).slice(-16000); });
    child.stdin.on('error', error => { failure = error; });
    const completed = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', code => code === 0 ? resolve() : reject(Error('FFmpeg 編碼失敗：' + (stderr || failure?.message || code)))); });
    completed.catch(() => {});
    return { child, completed, async write(frame) {
        if (failure || child.exitCode !== null || child.stdin.destroyed) throw failure || Error('FFmpeg 已停止。');
        await new Promise((resolve, reject) => child.stdin.write(frame, error => error ? reject(error) : resolve()));
    }, end() { child.stdin.end(); }, async stop() { child.kill(); await completed.catch(() => {}); } };
}
function frames(duration) { if (!Number.isFinite(duration) || duration <= 0 || duration > 21600) throw Error('音訊長度無效或超過六小時。'); return Math.ceil(duration * 60); }
module.exports = { resolver, temporary, args, run, frames };

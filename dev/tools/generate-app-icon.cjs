'use strict';
// 從 app/assets 的三個 SVG 產生 App 圖示：wavecanvas-16.svg（20 px 以下）、wavecanvas-small.svg（24–32 px）、wavecanvas.svg（40 px 以上）。
// 用 Electron 的 Chromium 點陣化，輸出 wavecanvas.png（256 px，視窗圖示）與多尺寸 wavecanvas.ico（App 與安裝檔）。
// 執行：npm run icon:build
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs'), path = require('node:path');
const assets = path.resolve(__dirname, '../../app/assets');
const SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256];
function ico(images) {
    // ICO 檔頭 + 每個尺寸一筆目錄 + PNG 內容（Windows Vista 以後支援 PNG 壓縮的圖示）。
    const header = Buffer.alloc(6); header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
    let offset = 6 + images.length * 16; const entries = [];
    for (const { size, png } of images) {
        const entry = Buffer.alloc(16);
        entry[0] = size >= 256 ? 0 : size; entry[1] = size >= 256 ? 0 : size; entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6);
        entry.writeUInt32LE(png.length, 8); entry.writeUInt32LE(offset, 12); offset += png.length; entries.push(entry);
    }
    return Buffer.concat([header, ...entries, ...images.map(image => image.png)]);
}
app.whenReady().then(async () => {
    const window = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
    await window.loadURL('data:text/html,<meta charset="utf-8"><body></body>');
    const large = fs.readFileSync(path.join(assets, 'wavecanvas.svg'), 'utf8'), small = fs.readFileSync(path.join(assets, 'wavecanvas-small.svg'), 'utf8'), tiny = fs.readFileSync(path.join(assets, 'wavecanvas-16.svg'), 'utf8');
    const images = [];
    for (const size of SIZES) {
        const svg = size <= 20 ? tiny : size <= 32 ? small : large;
        const data = await window.webContents.executeJavaScript(`new Promise((resolve, reject) => {
            const image = new Image(); image.onerror = reject;
            image.onload = () => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = ${size};
                canvas.getContext('2d').drawImage(image, 0, 0, ${size}, ${size}); resolve(canvas.toDataURL('image/png')); };
            image.src = 'data:image/svg+xml;base64,' + ${JSON.stringify(Buffer.from(svg).toString('base64'))};
        })`);
        images.push({ size, png: Buffer.from(data.split(',')[1], 'base64') });
    }
    fs.writeFileSync(path.join(assets, 'wavecanvas.png'), images.find(image => image.size === 256).png);
    fs.writeFileSync(path.join(assets, 'wavecanvas.ico'), ico(images));
    console.log('App icon: ' + SIZES.join(', ') + ' px');
    app.quit();
}).catch(error => { console.error(error); app.exit(1); });

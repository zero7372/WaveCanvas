// Rasterize the existing CSS WaveCanvas circle / five-bar mark; no third-party image.
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const size = 256, scan = Buffer.alloc((size * 4 + 1) * size);
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const radius = Math.hypot(x - 127.5, y - 127.5), bar = Math.round((x - 80) / 24), heights = [64, 112, 152, 112, 64];
    const bright = (radius >= 112 && radius <= 119) || (bar >= 0 && bar < 5 && Math.abs(x - (80 + bar * 24)) <= 7 && Math.abs(y - 127.5) <= heights[bar] / 2);
    const offset = y * (size * 4 + 1) + 1 + x * 4;
    scan.set(bright ? [133, 185, 238, 255] : radius < 119 ? [32, 35, 41, 255] : [0, 0, 0, 0], offset);
}
function chunk(type, data) {
    const body = Buffer.concat([Buffer.from(type), data]); let crc = 0xffffffff;
    for (const value of body) { crc ^= value; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
    const length = Buffer.alloc(4), checksum = Buffer.alloc(4); length.writeUInt32BE(data.length); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([length, body, checksum]);
}
const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
fs.writeFileSync(path.resolve(__dirname, '../../app/assets/wavecanvas.png'), Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR',header), chunk('IDAT',zlib.deflateSync(scan)), chunk('IEND',Buffer.alloc(0))]));

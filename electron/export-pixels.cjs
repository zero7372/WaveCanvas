'use strict';
const WIDTH = 1920, HEIGHT = 1080, FRAME_BYTES = WIDTH * HEIGHT * 4;

function validate(bitmap, width, height) {
    if (!Buffer.isBuffer(bitmap) || !Number.isInteger(width) || !Number.isInteger(height) ||
        width < WIDTH || height < HEIGHT + 1 || bitmap.length !== width * height * 4) {
        throw Error('Stage compositor pixel buffer 尺寸不正確。');
    }
}

function matchesFrame(bitmap, width, index) {
    const offset = HEIGHT * width * 4, value = index + 1;
    const rgb = [value & 255, (value >>> 8) & 255, (value >>> 16) & 255];
    return bitmap[offset + 3] === 255 && bitmap[offset + 7] === 255 &&
        rgb.every((v, channel) => bitmap[offset + 2 - channel] === v && bitmap[offset + 6 - channel] === 255 - v);
}

function stage(bitmap, width, reusable) {
    // toBitmap() owns its copy. A view keeps it alive without a second allocation.
    if (width === WIDTH) return bitmap.subarray(0, FRAME_BYTES);
    const buffer = reusable || Buffer.allocUnsafe(FRAME_BYTES);
    if (buffer.length !== FRAME_BYTES) throw Error('Stage row buffer 長度不正確。');
    for (let y = 0; y < HEIGHT; y++) bitmap.copy(buffer, y * WIDTH * 4, y * width * 4, y * width * 4 + WIDTH * 4);
    return buffer;
}

module.exports = { WIDTH, HEIGHT, FRAME_BYTES, validate, matchesFrame, stage };

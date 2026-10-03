'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const pixels = require('../../electron/export-pixels.cjs');
function surface(width, index) {
    const buffer = Buffer.alloc(width * 1081 * 4), offset = 1080 * width * 4, value = index + 1;
    for (let channel = 0; channel < 3; channel++) {
        const valueByte = (value >>> (channel * 8)) & 255;
        buffer[offset + 2 - channel] = valueByte;
        buffer[offset + 6 - channel] = 255 - valueByte;
    }
    buffer[offset + 3] = buffer[offset + 7] = 255;
    return buffer;
}
test('Frame identity rejects the previous frame, wrap boundaries and corrupt complement', () => {
    for (const index of [0, 1, 254, 255, 65534, 65535, 1295999]) {
        const buffer = surface(1920, index);
        assert.equal(pixels.matchesFrame(buffer, 1920, index), true);
        assert.equal(pixels.matchesFrame(buffer, 1920, index + 1), false);
        buffer[1080 * 1920 * 4 + 6] ^= 1;
        assert.equal(pixels.matchesFrame(buffer, 1920, index), false);
    }
});
test('Exact-width Stage excludes metadata row and keeps the owned bitmap alive without copying', () => {
    const bitmap = surface(1920, 600); pixels.validate(bitmap, 1920, 1081);
    const frame = pixels.stage(bitmap, 1920);
    assert.equal(frame.length, 8294400);
    assert.equal(frame.buffer, bitmap.buffer);
    assert.equal(frame.byteOffset, bitmap.byteOffset);
    bitmap[0] = 75; assert.equal(frame[0], 75);
    assert.equal(frame.at(-1), 0);
});
test('Rounded Windows stride removes only border pixels and safely reuses the bounded row buffer', () => {
    const bitmap = surface(1922, 120);
    for (let y = 0; y < 1080; y++) {
        bitmap.fill(y % 251, y * 1922 * 4, y * 1922 * 4 + 1920 * 4);
        bitmap.fill(255, y * 1922 * 4 + 1920 * 4, (y + 1) * 1922 * 4);
    }
    pixels.validate(bitmap, 1922, 1081); const reusable = Buffer.alloc(8294400);
    const frame = pixels.stage(bitmap, 1922, reusable); assert.equal(frame, reusable);
    for (let y = 0; y < 1080; y++) {
        assert.equal(frame[y * 1920 * 4], y % 251);
        assert.equal(frame[(y + 1) * 1920 * 4 - 1], y % 251);
    }
});
test('Invalid compositor surfaces fail before encoding and transparent metadata cannot authenticate', () => {
    assert.throws(() => pixels.validate(Buffer.alloc(4), 1920, 1081));
    assert.throws(() => pixels.validate(Buffer.alloc(1920 * 1080 * 4), 1920, 1080));
    const bitmap = surface(1920, 0); bitmap[1080 * 1920 * 4 + 3] = 0;
    assert.equal(pixels.matchesFrame(bitmap, 1920, 0), false);
});

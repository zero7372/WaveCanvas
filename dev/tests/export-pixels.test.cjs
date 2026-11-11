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
test('4K layout authenticates the doubled metadata row and crops the 3840 Stage', () => {
    const four = pixels.layout(2), width = 3842, height = 2162, index = 70000;
    const bitmap = Buffer.alloc(width * height * 4), offset = 2160 * width * 4, value = index + 1;
    for (const [x, invert] of [[0, false], [1, false], [2, true], [3, true]]) for (let channel = 0; channel < 3; channel++) {
        const byte = (value >>> (channel * 8)) & 255; bitmap[offset + x * 4 + 2 - channel] = invert ? 255 - byte : byte; bitmap[offset + x * 4 + 3] = 255;
    }
    four.validate(bitmap, width, height);
    assert.equal(four.matchesFrame(bitmap, width, index), true); assert.equal(four.matchesFrame(bitmap, width, index - 1), false);
    assert.equal(pixels.matchesFrame(bitmap, width, index), false, '1080p layout reads a different row');
    assert.equal(four.stage(bitmap, width).length, 3840 * 2160 * 4);
    assert.throws(() => four.validate(Buffer.alloc(1920 * 1081 * 4), 1920, 1081));
});

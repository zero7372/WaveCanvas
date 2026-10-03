'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { projectArgument } = require('../../electron/external-project.cjs');
test('Shell argv uses parsed absolute project paths without executing or splitting strings', () => {
    assert.equal(projectArgument(['--dev', 'H:\\測試專案\\My Song.waveproj']), 'H:\\測試專案\\My Song.waveproj');
    assert.equal(projectArgument(['relative.waveproj', '--file=H:\\bad.waveproj', 'H:\\bad.txt']), null);
    assert.equal(projectArgument(['H:\\bad\0.waveproj']), null);
    assert.equal(projectArgument(['H:\\資料\\名字.WAVEPROJ']), 'H:\\資料\\名字.WAVEPROJ');
});
test('Stable per-user installer identity, preservation and association configuration', () => {
    const p = require('../../package.json');
    assert.equal(p.version, '1.0.0'); assert.equal(p.build.appId, 'com.wavecanvas.desktop');
    assert.equal(p.build.nsis.perMachine, false); assert.equal(p.build.nsis.allowElevation, false);
    assert.equal(p.build.nsis.deleteAppDataOnUninstall, false); assert.equal(p.build.fileAssociations[0].ext, 'waveproj');
});

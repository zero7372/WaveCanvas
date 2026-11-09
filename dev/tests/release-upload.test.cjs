const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const { assets } = require('../tools/release-upload.cjs');
function release(files) {
    const output = fs.mkdtempSync(path.join(os.tmpdir(), 'wavecanvas-release-'));
    for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(output, name), text);
    return output;
}
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
test('Release upload always pairs the installer with its GPL source ZIP', () => {
    const output = release({ 'WaveCanvas-Setup-1.1.0.exe': 'exe', 'WaveCanvas-1.1.0-GPL-Source.zip': 'zip', 'THIRD_PARTY_NOTICES.md': 'n',
        'RELEASE-HASHES.txt': sha('exe') + '  WaveCanvas-Setup-1.1.0.exe\n' + sha('zip') + '  WaveCanvas-1.1.0-GPL-Source.zip\n' });
    assert.deepEqual(assets(output, '1.1.0').map(file => path.basename(file)), ['WaveCanvas-Setup-1.1.0.exe', 'WaveCanvas-1.1.0-GPL-Source.zip', 'RELEASE-HASHES.txt', 'THIRD_PARTY_NOTICES.md']);
});
test('Release upload refuses a missing source ZIP or a hash mismatch', () => {
    const missing = release({ 'WaveCanvas-Setup-1.1.0.exe': 'exe', 'THIRD_PARTY_NOTICES.md': 'n', 'RELEASE-HASHES.txt': sha('exe') + '  WaveCanvas-Setup-1.1.0.exe\n' });
    assert.throws(() => assets(missing, '1.1.0'), /GPL-Source\.zip/);
    const changed = release({ 'WaveCanvas-Setup-1.1.0.exe': 'exe', 'WaveCanvas-1.1.0-GPL-Source.zip': 'zip', 'THIRD_PARTY_NOTICES.md': 'n',
        'RELEASE-HASHES.txt': sha('old') + '  WaveCanvas-Setup-1.1.0.exe\n' + sha('zip') + '  WaveCanvas-1.1.0-GPL-Source.zip\n' });
    assert.throws(() => assets(changed, '1.1.0'), /不符/);
});

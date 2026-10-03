"""Package verified upstream inputs without claiming complete Corresponding Source."""
import hashlib
import io
import json
import pathlib
import shutil
import tarfile
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
META = ROOT / 'dev/release-source'
STAGE = ROOT / 'release/gpl-source'
EVIDENCE = ROOT / 'dev/reports/archive/gpl-source-2026-10-03'
assert STAGE.resolve().is_relative_to(ROOT), 'Source staging must remain inside the workspace'
manifest = json.loads((META / 'SOURCE-MANIFEST.json').read_text(encoding='utf-8'))
assert manifest['status'] == 'BLOCKED', 'This assembler only produces preparation artifacts'
archive = ROOT / 'release' / manifest['preparationArchive']
file_hashes = {}

def digest(data):
    return hashlib.sha256(data).hexdigest()

def safe_name(name):
    p = pathlib.PurePosixPath(name)
    assert not p.is_absolute() and '..' not in p.parts and '\\' not in name and ':' not in name, name
    return name

with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as output:
    def add(name, data):
        safe_name(name)
        assert name not in file_hashes, 'Duplicate source path: ' + name
        entry = zipfile.ZipInfo(name, (2026, 10, 3, 0, 0, 0))
        entry.compress_type = zipfile.ZIP_DEFLATED
        entry.external_attr = (0o100644 << 16)
        output.writestr(entry, data)
        file_hashes[name] = digest(data)

    for source in manifest['acquiredSources']:
        original = STAGE / 'upstream' / source['file']
        data = original.read_bytes()
        assert len(data) == source['bytes'] and digest(data) == source['sha256'], original
        add('upstream/' + source['file'], data)
        prefix = 'sources/' + source['id'] + '/'
        if source['file'].endswith('.zip'):
            with zipfile.ZipFile(io.BytesIO(data)) as upstream:
                roots = {n.split('/')[0] for n in upstream.namelist()}
                assert len(roots) == 1, 'Unexpected upstream structure'
                for item in upstream.infolist():
                    if not item.is_dir():
                        relative = item.filename.split('/', 1)[1]
                        add(prefix + safe_name(relative), upstream.read(item))
        else:
            with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as upstream:
                for item in upstream:
                    if item.isfile():
                        add(prefix + safe_name(item.name.split('/', 1)[1]), upstream.extractfile(item).read())
                    elif not item.isdir():
                        raise ValueError('Unsupported upstream link/device: ' + item.name)
    for file in sorted(META.iterdir()):
        if file.is_file() and file.name not in {'ARTIFACT.json', 'RELEASE-HASHES.txt'}:
            add(file.name, file.read_bytes())
            shutil.copyfile(file, STAGE / file.name)
    for file in sorted((ROOT / 'licenses').rglob('*')):
        if file.is_file():
            add('licenses/' + file.relative_to(ROOT / 'licenses').as_posix(), file.read_bytes())
    add('configuration/BUILD_CONFIG.txt', (EVIDENCE / 'ffmpeg-buildconf.txt').read_bytes())
    add('configuration/PROVIDER-README.txt', (ROOT / 'vendor/ffmpeg/README.txt').read_bytes())
    # Evidence is deliberately bounded; never include test profiles or media beyond the tiny SEI proof.
    evidence_files = ['binary-verification.json', 'ffmpeg-version.txt', 'ffmpeg-buildconf.txt', 'ffmpeg-L.txt',
                      'ffprobe-version.txt', 'ffprobe-buildconf.txt', 'ffprobe-L.txt', 'ffmpeg-commit.json',
                      'provider-release.json', 'provider-repository-tree.json', 'x264-commit.json',
                      'x264-sei.txt', 'x264-encode.txt', 'binary-strings.json', 'additional-source-downloads.json',
                      'avisynth-commit.json', 'rubberband-commit.json', 'vidstab-commit.json']
    for name in evidence_files:
        add('evidence/' + name, (EVIDENCE / name).read_bytes())
    output.writestr('FILE-HASHES.json', json.dumps(file_hashes, indent=2, sort_keys=True) + '\n')

# Read/decompress every entry, validate paths and bytes, nested upstream hashes and inner manifest.
with zipfile.ZipFile(archive) as check:
    assert check.testzip() is None
    assert len(check.namelist()) == len(set(check.namelist()))
    hashes = json.loads(check.read('FILE-HASHES.json'))
    assert set(check.namelist()) == set(hashes) | {'FILE-HASHES.json'}
    for name, expected in hashes.items():
        safe_name(name)
        assert digest(check.read(name)) == expected, name
    assert json.loads(check.read('SOURCE-MANIFEST.json')) == manifest
    for source in manifest['acquiredSources']:
        assert any(n.startswith('sources/' + source['id'] + '/') for n in hashes)
        assert digest(check.read('upstream/' + source['file'])) == source['sha256']
    # Verify actual extraction into an ignored, unique directory, not only ZIP listings.
    import tempfile
    with tempfile.TemporaryDirectory(prefix='verify-', dir=STAGE) as extracted:
        check.extractall(extracted)
        for name, expected in hashes.items():
            assert digest((pathlib.Path(extracted) / name).read_bytes()) == expected, name

result = {'status': 'PREPARATION_ONLY', 'completeCorrespondingSource': False,
          'file': archive.name, 'bytes': archive.stat().st_size, 'sha256': digest(archive.read_bytes()),
          'entries': len(file_hashes) + 1, 'extractionVerification': 'PASS',
          'sourceManifestSha256': digest((META / 'SOURCE-MANIFEST.json').read_bytes())}
(META / 'ARTIFACT.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
shutil.copyfile(META / 'ARTIFACT.json', STAGE / 'ARTIFACT.json')
shutil.copyfile(META / 'SOURCE-MANIFEST.json', ROOT / 'release/source-info/SOURCE-MANIFEST.json')
print(json.dumps(result, indent=2))

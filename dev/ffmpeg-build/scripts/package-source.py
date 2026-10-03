"""Package verified controlled source; no downloads, compiler binaries, or publication."""
import hashlib
import json
import pathlib
import shutil
import zipfile

root = pathlib.Path(__file__).resolve().parents[3]
base = root / 'dev/ffmpeg-build'
out = root / 'release'
out.mkdir(exist_ok=True)
build = json.loads((base / 'manifests/BUILD-MANIFEST.json').read_text())
closure = json.loads((base / 'manifests/CLOSURE-REVIEW.json').read_text())
sha = lambda data: hashlib.sha256(data).hexdigest()
jsonbytes = lambda value: (json.dumps(value, indent=2) + '\n').encode()
assert closure['status'] == 'PASS' and build['sourceVerification']['status'] == 'PASS'
actual = {path.replace('\\', '/').split('/')[-1] for path in build['linkedArchives']}
reviewed = {name for group in closure['groups'] for name in group['archives']}
assert actual == reviewed, (actual - reviewed, reviewed - actual)
for name, info in build['output'].items():
    assert sha((root / 'vendor/ffmpeg' / name).read_bytes()) == info['sha256'], name
files = {}
for name, source in build['sources'].items():
    data = (base / 'workspace/sources' / source['archive']).read_bytes()
    assert sha(data) == source['archiveSha256']
    files['upstream/' + source['archive']] = data
    with zipfile.ZipFile(base / 'workspace/sources' / source['archive']) as z:
        for item in z.infolist():
            if not item.is_dir():
                relative = item.filename.split('/', 1)[1]
                p = pathlib.PurePosixPath(relative)
                assert not p.is_absolute() and '..' not in p.parts
                files['sources/' + name + '/' + relative] = z.read(item)
for folder, target in [('manifests', 'manifests'), ('patches', 'patches')]:
    for p in (base / folder).glob('*'):
        if p.is_file(): files[target + '/' + p.name] = p.read_bytes()
scripts = ['bootstrap.ps1', 'build.ps1', 'build.sh', 'locked-toolchain.py', 'stage-sources.py', 'record-build.py']
for name in scripts: files['build-scripts/' + name] = (base / 'scripts' / name).read_bytes()
for name in ['BUILD_CONFIG.txt', 'VERSION.txt', 'SHA256.txt', 'ffmpeg-PE.txt', 'ffprobe-PE.txt', 'LINK-MAP.txt', 'config.h', 'config.mak']:
    files['build-evidence/' + name] = (base / 'output' / name).read_bytes()
for p in (root / 'licenses').rglob('*'):
    if p.is_file() and p.name not in ['SOURCE_MANIFEST.json', 'BUILD_INFO.json', 'DEPENDENCIES.json']:
        files['licenses/' + p.relative_to(root / 'licenses').as_posix()] = p.read_bytes()
deps = []
for name in ['x264', 'zlib']:
    s = build['sources'][name]
    deps.append(dict(id=name, revision=s['commit'], sourceArchive=s['archive'], archiveSha256=s['archiveSha256'],
                     sourceDirectory='sources/' + name + '/', sourceStatus='PASS', patchStatus='PASS', licenseStatus='PASS'))
for group in closure['groups'][3:]:
    deps.append(dict(id=group['id'], sourceStatus='N/A', patchStatus='N/A', licenseStatus='PASS',
                     exclusionReason=group['exclusionReason'], version=group.get('version'), archives=group['archives']))
source = lambda s: dict(tag=s.get('tag'), commit=s['commit'], file=s['archive'], archiveSha256=s['archiveSha256'], mappingStatus='PASS')
m = dict(schemaVersion=2, provider=build['provider'], status='PASS', staticClosureStatus='PASS', licenseClosureStatus='PASS',
         deliveryStatus='PASS', artifactReady=True, published=False, deliveryMode='alongside-installer', deliveryURL=None,
         publicationMetadata='Official release URL has not been decided; publication has not been performed.',
         deliveryStatement='Source package distributed alongside the WaveCanvas 1.0.0 installer: WaveCanvas-1.0.0-GPL-Source.zip',
         sourceArchive='WaveCanvas-1.0.0-GPL-Source.zip', plannedCompleteArtifact='WaveCanvas-1.0.0-GPL-Source.zip',
         ffmpegSource=source(build['sources']['ffmpeg']), libx264Source=source(build['sources']['x264']), dependencies=deps,
         buildRecipe=dict(status='PASS', providerScripts=['build-scripts/' + s for s in scripts]),
         patches=dict(status='PASS', provider=[], evidence='patches/PATCHES.md'),
         buildManifest='manifests/BUILD-MANIFEST.json', closureReview='manifests/CLOSURE-REVIEW.json', output=build['output'])
files['SOURCE-MANIFEST.json'] = jsonbytes(m)
files['README.md'] = ('''# WaveCanvas 1.0.0 corresponding source

This complete source package accompanies WaveCanvas-Setup-1.0.0.exe. Publication has not been performed; no official release URL is invented. Always distribute this ZIP alongside the installer. The manifest binds the exact installed ffmpeg/ffprobe hashes to the source inputs and recipes.

Full FFmpeg, x264 and zlib source snapshots and their original hash-verified archives are included offline. Zero WaveCanvas source patches. Standard compiler runtimes and Windows interfaces are reviewed individually in manifests/CLOSURE-REVIEW.json, including statically linked winpthreads/libatomic, with complete license notices. These exclusions do not claim exact MSYS2 source patch provenance; general purpose compiler tools are not redistributed here.

Requirements: Windows x64, PowerShell, Python 3.10+, an ASCII workspace path without spaces, and network access for the hash-pinned MSYS2 general purpose toolchain. Source inputs themselves need no network. Rebuild from this extracted directory:

```powershell
& ./build-scripts/bootstrap.ps1 -WorkspaceRoot H:/WaveCanvasRebuild
& ./build-scripts/build.ps1 -WorkspaceRoot H:/WaveCanvasRebuild -Jobs 8
```

Outputs are written to output/. Exact tool versions/packages, configure flags, source hashes, file hashes and output hashes are recorded under manifests/ and build-evidence/. No manually entered configure command is required. Byte identity across machines is not promised. x264 snapshot display version 0.165.x is not a revision counter; its exact upstream commit is in the manifest.

WaveCanvas launches standalone GPL executables through processes/pipes; it does not link their libraries into its MIT application. GPLv3-or-later applies to the FFmpeg executables. All original source/license files and WaveCanvas MIT attribution are retained. This is an engineering provenance review, not legal certification.
''').encode()
files['FILE-HASHES.json'] = jsonbytes({name: sha(data) for name, data in sorted(files.items())})
archive = out / m['sourceArchive']
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for name, data in sorted(files.items()):
        item = zipfile.ZipInfo(name, (2026, 10, 4, 0, 0, 0))
        item.compress_type = zipfile.ZIP_DEFLATED
        item.external_attr = 0o100644 << 16
        z.writestr(item, data)
m['sourceArchiveSha256'] = sha(archive.read_bytes())
(root / 'licenses/FFmpeg/SOURCE_MANIFEST.json').write_bytes(jsonbytes(m))
(root / 'licenses/FFmpeg/DEPENDENCIES.json').write_bytes(jsonbytes(dict(status='PASS', dependencies=deps, review=closure)))
(out / 'source-info').mkdir(exist_ok=True)
(out / 'source-info/SOURCE_MANIFEST.json').write_bytes(jsonbytes(m))
print(json.dumps(dict(file=str(archive), bytes=archive.stat().st_size, sha256=m['sourceArchiveSha256'], files=len(files))))

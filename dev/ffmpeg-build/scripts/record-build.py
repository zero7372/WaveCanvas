import hashlib
import json
import pathlib
import platform
import re
import sys
import zipfile

repo, work = map(lambda value: pathlib.Path(value).resolve(), sys.argv[1:3])
base = repo if (repo / 'manifests/SOURCES.lock.json').exists() else repo / 'dev/ffmpeg-build'
sources = json.loads((base / 'manifests/SOURCES.lock.json').read_text())
cache = base / ('upstream' if base == repo else 'workspace/sources')
output = work / 'output'
digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
verified_files = 0
for name, item in sources.items():
    archive = cache / item['archive']
    assert digest(archive) == item['archiveSha256']
    with zipfile.ZipFile(archive) as snapshot:
        for entry in snapshot.infolist():
            if not entry.is_dir():
                relative = entry.filename.split('/', 1)[1]
                assert (work / 'src' / name / relative).read_bytes() == snapshot.read(entry), name + '/' + relative
                verified_files += 1
versions = {name: (output / (name + '.txt')).read_text().strip() for name in ['compiler', 'linker', 'nasm', 'make', 'pkg-config']}
toolchain = {'os': platform.platform(), 'architecture': platform.machine(), 'environment': 'MSYS2 UCRT64',
             'versions': versions, 'installedPackages': (output / 'packages.txt').read_text().splitlines(),
             'bootstrap': json.loads((base / 'manifests/BOOTSTRAP.lock.json').read_text()),
             'packageArchives': json.loads((base / 'manifests/TOOLCHAIN_PACKAGES.lock.json').read_text()),
             'globalPATHModified': False}
(output / 'TOOLCHAIN-MANIFEST.json').write_text(json.dumps(toolchain, indent=2) + '\n', encoding='utf-8')
config = (output / 'config.mak').read_text()
configure = re.search(r'^FFMPEG_CONFIGURATION=(.*)$', config, re.M)[1]
link_map = (output / 'LINK-MAP.txt').read_text(errors='replace')
linked = sorted(set(re.findall(r'(?im)^LOAD (.+?\.(?:a|lib))\s*$', link_map)))
imports = {name: sorted(set(re.findall(r'DLL Name: (.+)', (output / (name + '-PE.txt')).read_text()))) for name in ['ffmpeg','ffprobe']}
result = {'schemaVersion': 1, 'provider': 'WaveCanvas controlled FFmpeg build', 'sources': sources,
          'sourceVerification': {'status': 'PASS', 'originalFilesCompared': verified_files, 'sourceModifications': []},
          'patches': [], 'toolchain': toolchain, 'configure': configure,
          'linkedArchives': linked, 'systemDLLImports': imports,
          'compilerRuntimeClassification': 'GCC libgcc/libatomic: standard compiler runtime with Runtime Library Exception; MinGW CRT: standard C/Windows interface support; Windows UCRT/system DLLs are OS system components. Exact installed license texts are retained.',
          'output': {name: {'bytes': (output / name).stat().st_size, 'sha256': digest(output / name)} for name in ['ffmpeg.exe','ffprobe.exe']}}
(output / 'BUILD-MANIFEST.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
(output / 'BUILD_CONFIG.txt').write_bytes((output / 'ffmpeg-BUILD_CONFIG.txt').read_bytes())
(output / 'VERSION.txt').write_bytes((output / 'ffmpeg-VERSION.txt').read_bytes())
(output / 'SHA256.txt').write_text(''.join(item['sha256'] + '  ' + name + '\n' for name, item in result['output'].items()), encoding='utf-8')
print('Provenance PASS: ' + str(verified_files) + ' original source files unmodified; zero source patches.')

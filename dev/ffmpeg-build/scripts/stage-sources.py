import hashlib
import json
import pathlib
import sys
import urllib.request
import zipfile

repo, workspace = map(lambda p: pathlib.Path(p).resolve(), sys.argv[1:3])
bundle = (repo / 'manifests/SOURCES.lock.json').exists()
base = repo if bundle else repo / 'dev/ffmpeg-build'
lock = json.loads((base / 'manifests/SOURCES.lock.json').read_text())
cache = base / ('upstream' if bundle else 'workspace/sources')
cache.mkdir(parents=True, exist_ok=True)
for name, item in lock.items():
    assert len(item['commit']) == 40 and all(c in '0123456789abcdef' for c in item['commit'])
    archive = cache / item['archive']
    if not archive.exists():
        request = urllib.request.Request(item['archiveURL'], headers={'User-Agent': 'WaveCanvas-controlled-build'})
        with urllib.request.urlopen(request) as response:
            archive.write_bytes(response.read())
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == item['archiveSha256'], name
    target = workspace / 'src' / name
    target.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as source:
        for entry in source.infolist():
            if entry.is_dir():
                continue
            relative = pathlib.PurePosixPath(entry.filename.split('/', 1)[1])
            assert not relative.is_absolute() and '..' not in relative.parts
            output = target.joinpath(*relative.parts)
            output.parent.mkdir(parents=True, exist_ok=True)
            content = source.read(entry)
            if not output.exists() or output.read_bytes() != content:
                output.write_bytes(content)
    print(name + ' pinned upstream snapshot: ' + item['commit'], flush=True)

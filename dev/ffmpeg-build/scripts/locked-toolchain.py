import hashlib
import json
import pathlib
import shutil
import sys
import urllib.request

repo, work = map(lambda value: pathlib.Path(value).resolve(), sys.argv[1:3])
base = repo if (repo / 'manifests/TOOLCHAIN_PACKAGES.lock.json').exists() else repo / 'dev/ffmpeg-build'
lock = json.loads((base / 'manifests/TOOLCHAIN_PACKAGES.lock.json').read_text())
cache = work / 'toolchain-cache'
cache.mkdir(parents=True, exist_ok=True)
for package in lock['packages']:
    file = cache / package['file']
    assert file.resolve().is_relative_to(cache)
    if not file.exists():
        existing = work / 'msys64/var/cache/pacman/pkg' / package['file']
        if existing.exists():
            shutil.copyfile(existing, file)
        else:
            request = urllib.request.Request(package['url'], headers={'User-Agent': 'WaveCanvas-controlled-build'})
            with urllib.request.urlopen(request) as response:
                file.write_bytes(response.read())
    assert file.stat().st_size == package['bytes']
    assert hashlib.sha256(file.read_bytes()).hexdigest() == package['sha256'], package['file']
print('Pinned toolchain archive verification PASS')

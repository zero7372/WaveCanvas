"""Structural/integrity public gate. Does not certify legal correspondence."""
import hashlib
import json
import pathlib
import sys
import zipfile

archive, manifest_path = map(pathlib.Path, sys.argv[1:3])
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
assert manifest['status'] == 'PASS'
assert hashlib.sha256(archive.read_bytes()).hexdigest() == manifest['sourceArchiveSha256']
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    names = z.namelist()
    assert len(names) == len(set(names))
    for name in names:
        p = pathlib.PurePosixPath(name)
        assert not p.is_absolute() and '..' not in p.parts and '\\' not in name and ':' not in name
    hashes = json.loads(z.read('FILE-HASHES.json'))
    assert {n for n in names if not n.endswith('/')} == set(hashes) | {'FILE-HASHES.json'}
    for name, expected in hashes.items():
        assert hashlib.sha256(z.read(name)).hexdigest() == expected, name
    inner = json.loads(z.read('SOURCE-MANIFEST.json'))
    # A ZIP cannot contain its own final digest; this one outer-only field is excluded.
    inner.pop('sourceArchiveSha256', None)
    outer = dict(manifest)
    outer.pop('sourceArchiveSha256', None)
    assert inner == outer, 'Inner/outer source mapping differs'
    for item in manifest['dependencies']:
        if item['sourceStatus'] == 'N/A':
            assert item['exclusionReason']
            continue
        original = 'upstream/' + item['sourceArchive']
        assert hashlib.sha256(z.read(original)).hexdigest() == item['archiveSha256']
        directory = item.get('sourceDirectory', 'sources/' + item['id'] + '/')
        assert any(n.startswith(directory) for n in names), directory
    for item in [manifest['ffmpegSource'], manifest['libx264Source']]:
        assert hashlib.sha256(z.read('upstream/' + item['file'])).hexdigest() == item['archiveSha256']
    build = json.loads(z.read(manifest['buildManifest']))
    closure = json.loads(z.read(manifest['closureReview']))
    assert build['output'] == manifest['output']
    assert build['patches'] == [] and build['sourceVerification']['sourceModifications'] == []
    assert build['sourceVerification']['status'] == 'PASS' and closure['status'] == 'PASS'
    actual = {p.replace('\\', '/').split('/')[-1] for p in build['linkedArchives']}
    assert actual == {a for group in closure['groups'] for a in group['archives']}
    import io
    count = 0
    for component, source in build['sources'].items():
        data = z.read('upstream/' + source['archive'])
        assert hashlib.sha256(data).hexdigest() == source['archiveSha256']
        with zipfile.ZipFile(io.BytesIO(data)) as upstream:
            for entry in upstream.infolist():
                if not entry.is_dir():
                    relative = entry.filename.split('/', 1)[1]
                    assert z.read('sources/' + component + '/' + relative) == upstream.read(entry), relative
                    count += 1
    assert count == build['sourceVerification']['originalFilesCompared']
    scripts = manifest['buildRecipe']['providerScripts']
    for script in scripts if isinstance(scripts, list) else [scripts]:
        assert script in hashes, 'Provider script missing: ' + script
    assert manifest['patches']['evidence'] in hashes, 'Patch/no-patch provenance evidence missing'
    for patch in manifest['patches']['provider']:
        assert patch in hashes
print('Complete source ZIP structural/hash verification PASS; legal correspondence requires reviewed evidence.')

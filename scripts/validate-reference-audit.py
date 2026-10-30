from pathlib import Path
from hashlib import sha256
from PIL import Image
import json

ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/content/site-reference'
def load(path):return json.loads(path.read_text(encoding='utf-8'))
records=load(OUT/'media-inventory.json');summary=load(OUT/'summary.json')
projects={p['id'] for p in load(ROOT/'src/data/projects.json')}
locations=load(ROOT/'docs/content/pdf-source-locations.json')
assert len(records)==summary['downloadedUrlCount']==100
assert len({e['sourceUrl']for e in records})==len(records)
assert len({e['localPath']for e in records})==len(records)
ids={e['id']for e in records}
for e in records:
    path=(ROOT/e['localPath']).resolve()
    assert path.is_relative_to((OUT/'media').resolve()),e['localPath']
    assert not path.is_relative_to((ROOT/'public').resolve())
    data=path.read_bytes()
    assert len(data)==e['bytes'] and sha256(data).hexdigest()==e['sha256'],e['id']
    assert e['projectId'] is None or e['projectId']in projects
    assert e['publicDisplayEnabled'] is False
    if e.get('exactDuplicateOf'):
        assert e['exactDuplicateOf']in ids
        other=next(r for r in records if r['id']==e['exactDuplicateOf'])
        assert other['sha256']==e['sha256']
    if e['type']=='image':
        with Image.open(path)as image:assert image.size==(e['width'],e['height'])
    comparison=e.get('pdfComparison')or{}
    if comparison.get('verifiedMatchingImage'):
        src=comparison['verifiedMatchingImage']
        assert (ROOT/locations.get(src,'public'+src)).exists()
assert sum(e['bytes']for e in records)==summary['totalBytes']
gallery=[e for e in records if e['collection']=='perspectives']
assert len(gallery)==61 and sum(e['type']=='image'for e in gallery)==59
pagination=load(OUT/'gallery-pagination.json')
assert pagination['firstBatchCount']+pagination['secondBatchCount']==61
assert load(OUT/'source/gallery-page-2.json')['hasNextPage']is False
videos=[e for e in records if e['type']=='video']
assert len(videos)==2 and videos[0]['sha256']==videos[1]['sha256']
assert all((e['width'],e['height'],e['durationSeconds'])==(1080,1920,27.5)for e in videos)
for page in load(OUT/'source/page-capture.json'):
    assert page['status']==200
    assert sha256((ROOT/page['localHtml']).read_bytes()).hexdigest()==page['sha256']
print(f"Audit valide : 8 pages, 61 médias de galerie sur 2 lots, {len(records)} téléchargements / {summary['totalBytes']} octets ; chemins, dimensions, empreintes, doublons et absence d’affichage public vérifiés.")

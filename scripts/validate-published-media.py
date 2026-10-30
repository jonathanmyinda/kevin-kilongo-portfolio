from pathlib import Path
from hashlib import sha256
from PIL import Image
import json,re

ROOT=Path(__file__).resolve().parents[1]
def load(path):return json.loads((ROOT/path).read_text(encoding='utf-8'))
assets=load('docs/content/published-media-manifest.json')
display=load('src/data/published-media.json')
sources={e['id']:e for e in load('docs/content/site-reference/media-inventory.json')}
assert len(display['projects'])==18
for project in display['projects'].values():
    assert project['images']and project['coverImage']in [e['src']for e in project['images']]
    assert len({e['src']for e in project['images']})==len(project['images'])
files=[]
for image in assets:
    assert image['alt'] and image['width']<=image['originalWidth']and image['height']<=image['originalHeight']
    source=ROOT/image['sourceLocalPath']
    assert sha256(source.read_bytes()).hexdigest()==image['sourceSha256']
    if image['sourceKind']=='site123':
        record=sources[image['sourceAssetId']]
        assert record['associationStatus']in ['visually-verified','site-context']
        assert record['assetKind']not in ['presentation-board','video','service-illustration']
    for record in [image,*image['variants']]:
        path=ROOT/'public'/record['src'].lstrip('/');data=path.read_bytes()
        assert len(data)==record['bytes']and sha256(data).hexdigest()==record['sha256']
        with Image.open(path)as im:assert im.size==(record['width'],record['height'])
        files.append(record['src'])
expected=set(files)
base=(ROOT/'public/images/optimized').resolve()
actual={'/'+path.relative_to(ROOT/'public').as_posix()for path in base.rglob('*')if path.is_file()}
assert actual==expected,'Dérivé manquant ou export inutilisé dans public/images/optimized'
assert len(files)==len(set(files))
assert not list((ROOT/'public').rglob('*.mp4'))
# Contrast for the actual theme tokens, not a browser/layout audit.
css=(ROOT/'src/index.css').read_text(encoding='utf-8')
tokens=dict(re.findall(r'--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;',css))
def luminance(hex):
    rgb=[int(hex[i:i+2],16)/255 for i in (1,3,5)]
    rgb=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    return sum(a*b for a,b in zip(rgb,[.2126,.7152,.0722]))
contrasts={}
for text,bg in [('ink','surface'),('muted','surface'),('muted','surface-raised'),('accent','surface'),('night','accent'),('plan-ink','plan-mat')]:
    a,b=sorted([luminance(tokens[text]),luminance(tokens[bg])]);ratio=(b+.05)/(a+.05)
    assert ratio>=4.5,(text,bg,ratio)
    contrasts[f'{text}/{bg}']=round(ratio,2)
summary=load('docs/content/published-media-summary.json')
summary['contrastRatios']=contrasts
font_bytes=sum(p.stat().st_size for p in (ROOT/'public/fonts').glob('*.woff2'))
summary['fontBytes']=font_bytes
summary['pdfBytes']=(ROOT/'public/documents/portfolio-kevin-kilongo-munganga.pdf').stat().st_size
summary['totalMediaBytesExcludingPdf']=summary['imageBytes']+font_bytes
(ROOT/'docs/content/published-media-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(summary,ensure_ascii=True))

"""Publish only selected, attributed media; preserve untouched source bytes."""
from pathlib import Path
from PIL import Image, ImageOps
from hashlib import sha256
import json, shutil

ROOT=Path(__file__).resolve().parents[1]
def read(path):return json.loads((ROOT/path).read_text(encoding='utf-8'))
def save(path,obj):
    target=ROOT/path;target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
originals=read('docs/content/image-manifest.json')
locations={}
for image in originals:
    source=(ROOT/'public'/image['src'].lstrip('/')).resolve()
    archive=(ROOT/'docs/content/pdf-media-originals'/image['src'].removeprefix('/images/')).resolve()
    assert archive.is_relative_to((ROOT/'docs/content/pdf-media-originals').resolve())
    if source.exists():
        assert source.is_relative_to((ROOT/'public/images').resolve())
        assert sha256(source.read_bytes()).hexdigest()==image['sha256']
        archive.parent.mkdir(parents=True,exist_ok=True)
        if not archive.exists():shutil.move(str(source),str(archive))
        else:
            assert sha256(archive.read_bytes()).hexdigest()==image['sha256']
            source.unlink() # Only verified redundant original bytes, preserved in archive.
    assert archive.exists() and sha256(archive.read_bytes()).hexdigest()==image['sha256']
    locations[image['src']]=archive.relative_to(ROOT).as_posix()
save('docs/content/pdf-source-locations.json',locations)

inventory={e['id']:e for e in read('docs/content/site-reference/media-inventory.json')}
source_projects=read('src/data/projects.json')
assets=[]
def publish(source,slug,name,metadata):
    source=ROOT/source
    with Image.open(source)as original:
        im=ImageOps.exif_transpose(original).convert('RGB');sw,sh=im.size
        drawing=metadata.get('kind')=='drawing'
        max_width=sw if drawing else 1600
        if im.width>max_width:im=im.resize((max_width,round(im.height*max_width/im.width)),Image.Resampling.LANCZOS)
        path=ROOT/f'public/images/optimized/{slug}/{name}.webp';path.parent.mkdir(parents=True,exist_ok=True)
        if drawing:
            path=path.with_suffix(source.suffix)
            shutil.copyfile(source,path) # Preserve native compressed plans, without lossy re-encoding.
        else:
            im.save(path,'WEBP',quality=86,method=6)
            # Avoid larger re-encodings of JPEGs that are already compact.
            if source.suffix.lower()in ['.jpg','.jpeg']and path.stat().st_size>source.stat().st_size:
                assert path.resolve().is_relative_to((ROOT/'public/images/optimized').resolve())
                path.unlink()
                path=path.with_suffix('.jpg');shutil.copyfile(source,path)
                im=ImageOps.exif_transpose(original).convert('RGB')
        entry={**metadata,'src':'/'+path.relative_to(ROOT/'public').as_posix(),'width':im.width,'height':im.height,'bytes':path.stat().st_size,'sha256':sha256(path.read_bytes()).hexdigest(),'sourceLocalPath':source.relative_to(ROOT).as_posix(),'sourceSha256':sha256(source.read_bytes()).hexdigest(),'originalWidth':sw,'originalHeight':sh}
        variants=[]
        if im.width>960:
            preview=im.resize((640,round(im.height*640/im.width)),Image.Resampling.LANCZOS)
            small=path.with_name(path.stem+'-640.webp');preview.save(small,'WEBP',quality=92 if drawing else 86,method=6)
            variants.append({'src':'/'+small.relative_to(ROOT/'public').as_posix(),'width':preview.width,'height':preview.height,'bytes':small.stat().st_size,'sha256':sha256(small.read_bytes()).hexdigest()})
            entry['srcSet']=f"{variants[0]['src']} 640w, {entry['src']} {entry['width']}w"
        entry['variants']=variants;assets.append(entry)
        return entry

def pdf_image(image,slug):
    return publish(locations[image['src']],slug,Path(image['src']).stem,{'alt':image['alt'],'kind':image['kind'],'credit':image.get('credit'),'sourceKind':'pdf','sourcePage':image['sourcePage'],'sourceAsset':image['src']})
def site_image(id,project=None,alt=None):
    e=inventory[id]
    assert e['associationStatus']in ['visually-verified','site-context']and e['assetKind']!='presentation-board'
    assert not project or e.get('projectId')==project['id']
    slug=project['slug']if project else 'profile-services'
    return publish(e['localPath'],slug,f'{slug}-{id}',{'alt':alt,'kind':'render-3d'if project else 'photograph','credit':project['agency']if project else None,'sourceKind':'site123','sourceAssetId':id,'sourceUrl':e['sourceUrl'],'referencePdfPages':(e.get('pdfComparison')or{}).get('verifiedSourcePages',[])})

# Choose versions after visual comparison. Duplicate cameras and composite boards
# remain in the audit. Mont-Ngafula retains its original OS’ARTS watermark.
replacements={
    '/images/kimia-tower/kimia-tower-p12-01.jpg':('gallery-034','Perspective 3D de la façade sur rue, de jour'),
    '/images/residence-bandalungwa/residence-bandalungwa-p20-02.jpg':('gallery-006','Rendu 3D de la résidence, vue d’angle'),
    '/images/horizon-luxe/horizon-luxe-p19-01.jpg':('gallery-009','Perspective 3D d’ensemble de l’immeuble'),
    '/images/horizon-luxe/horizon-luxe-p19-03.jpg':('gallery-014','Perspective 3D de l’entrée et du portail'),
    '/images/restaurant-palms/restaurant-palms-p28-01.jpg':('gallery-003','Rendu 3D de la salle sous pergola'),
    '/images/hotel-presidentiel-gemena/hotel-presidentiel-gemena-p25-01.jpg':('gallery-011','Rendu 3D de la marquise et du parvis d’arrivée'),
    '/images/minimal-house/minimal-house-p29-02.jpg':('gallery-025','Rendu 3D du rooftop'),
    '/images/minimal-house/minimal-house-p29-03.jpg':('gallery-023','Rendu 3D d’angle au crépuscule'),
}
additions={2:[('gallery-033','Perspective 3D d’ensemble de jour'),('gallery-035','Perspective 3D d’ensemble de nuit')],5:[('gallery-030','Rendu 3D des jardins du centre oncologique')],8:[('gallery-007','Rendu 3D d’angle depuis la rue')],13:[('gallery-002','Rendu 3D de la rue et des villas')],16:[('gallery-024','Variante de jour de la façade, rendu 3D')]}
overlays={}
for project in source_projects:
    images=[];cover=None
    for image in project['images']:
        if image['src']=='/images/residence-bandalungwa/residence-bandalungwa-p20-03.jpg':continue # Repeated frontal camera, smaller than the retained cover.
        if image['src']in replacements:
            id,label=replacements[image['src']];entry=site_image(id,project,f"{project['title']} — {label}")
        else:entry=pdf_image(image,project['slug'])
        images.append(entry)
        if image['src']==project['coverImage']:cover=entry['src']
    for id,label in additions.get(project['number'],[]):
        entry=site_image(id,project,f"{project['title']} — {label}");images.append(entry)
        if project['number']==5:cover=entry['src']
    overlays[project['id']]={'images':images,'coverImage':cover}
hero=site_image('portrait-accueil',alt='Kevin Kilongo Munganga, portrait en noir et blanc')
portrait=site_image('portrait-couleur',alt='Kevin Kilongo Munganga, portrait en couleur')
services={
    'suivi':site_image('service-suivi',alt='Visite de chantier entre les fouilles et les coffrages'),
    'conseil':site_image('service-conseil',alt='Kevin Kilongo sur chantier, devant des coffrages en bois'),
}
# Different projects/views from the six cover images, with existing roles intact.
perspectives=[]
choices=[('project-08','gallery-007'),('project-16','gallery-024'),('project-12','gallery-011'),('project-04',None)]
for project_id,source_id in choices:
    image=next(im for im in overlays[project_id]['images']if im.get('sourceAssetId')==source_id)if source_id else overlays[project_id]['images'][0]
    perspectives.append({'projectId':project_id,'image':image})
save('src/data/published-media.json',{'projects':overlays,'heroPortrait':hero,'portrait':portrait,'services':services,'perspectives':perspectives})
save('docs/content/published-media-manifest.json',assets)
files=[{'src':e['src'],'bytes':e['bytes']}for e in assets]+[v for e in assets for v in e['variants']]
expected={e['src']for e in files}
base=(ROOT/'public/images/optimized').resolve()
for path in base.rglob('*'):
    if path.is_file()and '/'+path.relative_to(ROOT/'public').as_posix()not in expected:
        assert path.resolve().is_relative_to(base)
        path.unlink() # Obsolete generated export only; original sources are preserved.
summary={'mainImages':len(assets),'responsiveVariants':len(files)-len(assets),'publishedImageFiles':len(files),'imageBytes':sum(e['bytes']for e in files),'sourceImageBytes':sum((ROOT/e['sourceLocalPath']).stat().st_size for e in assets),'siteSourceIds':sorted({e['sourceAssetId']for e in assets if e.get('sourceAssetId')}),'archivedPdfImages':len(locations)}
save('docs/content/published-media-summary.json',summary)
print(json.dumps(summary))

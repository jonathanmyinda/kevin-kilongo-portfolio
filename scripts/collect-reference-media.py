from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse
from PIL import Image
import importlib.util
import json
import re
import io

spec = importlib.util.spec_from_file_location('reference_capture', Path(__file__).with_name('audit-reference-site.py'))
capture = importlib.util.module_from_spec(spec); spec.loader.exec_module(capture)
ROOT, OUT, fetch, save_json = capture.ROOT, capture.OUT, capture.fetch, capture.save_json

class Items(HTMLParser):
    def __init__(self): super().__init__(); self.items=[]
    def handle_starttag(self, tag, attrs):
        d=dict(attrs)
        if d.get('data-mfp-src'): self.items.append(d)

def collect():
    first=Items();first.feed((OUT/'source/pages/perspectives.html').read_text(encoding='utf-8'))
    second=Items();page2=json.loads((OUT/'source/gallery-page-2.json').read_text(encoding='utf-8'));second.feed(page2['itemsHtml'])
    all_items=first.items+second.items
    unique={item['data-mfp-src']:item for item in all_items}
    entries=[]
    for n,(url,item) in enumerate(unique.items(),1):
        entries.append({'id':f'gallery-{n:03d}','sourceUrl':url,'sourcePages':['perspectives'],'collection':'perspectives','siteItemUrl':capture.BASE.rstrip('/')+item['data-image-page-url'],'declaredOriginalWidth':int(item['data-original-width']),'declaredOriginalHeight':int(item['data-original-height']),'titleOnSite':item.get('title') or None,'descriptionOnSite':item.get('data-image-description') or None,'type':item['data-type']})
    extras=[('portrait-couleur','2000_6ad462e0b6083.jpg',['a-propos','accueil']),('portrait-accueil','2000_6a3c471a3b2a2.jpg',['accueil']),('portrait-meta','800_6a3c471a3b2a2.jpg',['accueil','a-propos','services']),('service-conception','800_gi-6a3c46cc308d0.jpg',['services','accueil']),('service-suivi','800_6a3ca617009b9.jpg',['services','accueil']),('service-conseil','800_6a3d465311689.jpg',['services','accueil'])]
    for name,file,pages in extras: entries.append({'id':name,'sourceUrl':'https://files.cdn-files-a.com/uploads/12220345/'+file,'sourcePages':pages,'collection':'profile-services','type':'image'})
    html=(OUT/'source/pages/portfolio-detail.html').read_text(encoding='utf-8')
    sheets=list(dict.fromkeys(re.findall(r'https://files\.cdn-files-a\.com/uploads/12220345/2000_6ad5aa[\w]+\.jpg',html)))
    for n,url in enumerate(sheets,1): entries.append({'id':f'portfolio-sheet-{n:02d}','sourceUrl':url,'sourcePages':['portfolio-detail'],'collection':'portfolio-sheets','type':'image','usageRecommendation':'Archive de planche uniquement ; ne pas utiliser comme image de galerie.'})
    entries.append({'id':'portfolio-cover','sourceUrl':'https://files.cdn-files-a.com/uploads/12220345/800_6ad5a9e26a18d.jpg','sourcePages':['portfolio','portfolio-detail'],'collection':'portfolio-sheets','type':'image','usageRecommendation':'Archive / vignette du portfolio ; pas une galerie de projet.'})
    save_json(OUT/'gallery-pagination.json',{'firstBatchCount':len(first.items),'secondBatchCount':len(second.items),'hasNextPage':page2['hasNextPage'],'uniqueMediaCount':len(unique),'images':sum(e['type']=='image' for e in entries if e['collection']=='perspectives'),'videos':sum(e['type']=='video' for e in entries if e['collection']=='perspectives'),'method':'Public infinite-scroll GET, same parameters as source scripts; no browser scrolling claimed.'})
    existing_path=OUT/'media-inventory.json'
    existing={e['id']:e for e in json.loads(existing_path.read_text(encoding='utf-8'))} if existing_path.exists() else {}
    def download(entry):
        e={**existing.get(entry['id'],{}),**entry};e.pop('error',None);filename=Path(urlparse(e['sourceUrl']).path).name
        captured_path=ROOT/e['localPath'] if e.get('localPath') else None
        path=captured_path if captured_path and captured_path.exists() else OUT/'media'/e['collection']/filename
        try:
            if path.exists(): data=path.read_bytes();e['reusedCapture']=True
            else:
                data,status,final,headers=fetch(e['sourceUrl']);path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
                e.update({'httpStatus':status,'resolvedUrl':final,'contentType':headers.get('Content-Type')})
            e.update({'localPath':path.relative_to(ROOT).as_posix(),'bytes':len(data),'sha256':capture.sha256(data).hexdigest(),'retrievedAt':e.get('retrievedAt',capture.datetime.now(capture.timezone.utc).isoformat()),'projectId':None,'associationStatus':'unreviewed','credit':None,'exactDuplicateOf':None,'pdfComparison':None,'usageRecommendation':e.get('usageRecommendation','Conserver hors affichage public jusqu’à identification vérifiée.')})
            if e['type']=='image':
                with Image.open(io.BytesIO(data)) as image:
                    image.load(); e.update({'width':image.width,'height':image.height,'format':image.format,'mode':image.mode})
                    rgb=image.convert('RGB');e['decodedPixelSha256']=capture.sha256(rgb.tobytes()).hexdigest()
            else: e.update({'width':None,'height':None,'durationSeconds':None})
        except Exception as error:e['error']=str(error)
        return e
    with capture.ThreadPoolExecutor(max_workers=4) as pool: records=list(pool.map(download,entries))
    seen={}
    for e in records:
        h=e.get('sha256')
        if h in seen:e['exactDuplicateOf']=seen[h]
        elif h:seen[h]=e['id']
    save_json(OUT/'media-inventory.json',records)
    print(json.dumps({'total':len(records),'downloaded':sum('localPath'in e for e in records),'errors':[(e['id'],e['error'])for e in records if 'error'in e],'bytes':sum(e.get('bytes',0)for e in records),'gallery':json.loads((OUT/'gallery-pagination.json').read_text(encoding='utf-8'))},ensure_ascii=True))

if __name__=='__main__': collect()

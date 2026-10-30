from pathlib import Path
from PIL import Image, ImageOps, ImageChops, ImageStat, ImageDraw
from hashlib import sha256
import json, math, struct

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/content/site-reference'
def load(path):return json.loads(path.read_text(encoding='utf-8'))
def save(path,value):path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def thumb(path):
    with Image.open(path) as image:return ImageOps.exif_transpose(image).convert('RGB').resize((64,64))
def difference_hash(image):
    values=list(image.convert('L').resize((17,16)).get_flattened_data())
    return sum((values[y*17+x]>values[y*17+x+1])<<(y*16+x)for y in range(16)for x in range(16))
def boxes(data,start=0,end=None):
    end=end or len(data);pos=start
    while pos+8<=end:
        size,kind=struct.unpack_from('>I4s',data,pos);head=8
        if size==1:size=struct.unpack_from('>Q',data,pos+8)[0];head=16
        if size==0:size=end-pos
        if size<head or pos+size>end:break
        yield kind,pos+head,pos+size
        pos+=size
def mp4_metadata(path):
    data=path.read_bytes();out={'mdatSha256':[],'tracks':[]}
    for kind,start,end in boxes(data):
        if kind==b'mdat':out['mdatSha256'].append(sha256(data[start:end]).hexdigest())
        if kind!=b'moov':continue
        for child,a,b in boxes(data,start,end):
            if child==b'mvhd':
                version=data[a];off=a+(20 if version else 12)
                timescale=struct.unpack_from('>I',data,off)[0]
                duration=struct.unpack_from('>Q' if version else '>I',data,off+4)[0]
                out['durationSeconds']=duration/timescale
            if child==b'trak':
                for atom,x,y in boxes(data,a,b):
                    if atom==b'tkhd':
                        width,height=struct.unpack_from('>II',data,y-8)
                        out['tracks'].append({'width':width/65536,'height':height/65536})
    return out

records=load(OUT/'media-inventory.json');pdf=load(ROOT/'docs/content/image-manifest.json')
locations_path=ROOT/'docs/content/pdf-source-locations.json'
locations=load(locations_path)if locations_path.exists()else {}
pdfdata=[]
for item in pdf:
    path=ROOT/locations.get(item['src'],'public'+item['src'])
    t=thumb(path)
    with Image.open(path)as im:pixhash=sha256(im.convert('RGB').tobytes()).hexdigest()
    pdfdata.append((item,t,difference_hash(t),pixhash))
for record in records:
    if not record.get('localPath'):continue
    path=ROOT/record['localPath']
    if record['type']=='video':
        record['videoAnalysis']=mp4_metadata(path)
        record['durationSeconds']=record['videoAnalysis'].get('durationSeconds')
        video=next((t for t in record['videoAnalysis']['tracks']if t['width']>0),None)
        if video:record['width']=int(video['width']);record['height']=int(video['height'])
        continue
    t=thumb(path);dh=difference_hash(t);rank=[]
    for p,pt,pdh,pixelhash in pdfdata:
        delta=ImageChops.difference(t,pt);rms=math.sqrt(sum(x*x for x in ImageStat.Stat(delta).rms)/3)
        rank.append({'src':p['src'],'sourcePage':p['sourcePage'],'width':p['width'],'height':p['height'],'credit':p['credit'],'rms64':round(rms,3),'dHashDistance':(dh^pdh).bit_count(),'exactBytes':record['sha256']==p['sha256'],'exactPixels':record.get('decodedPixelSha256')==pixelhash})
    rank.sort(key=lambda i:i['rms64'])
    record['pdfComparison']={'exactByteMatches':[i['src']for i in rank if i['exactBytes']],'exactPixelMatches':[i['src']for i in rank if i['exactPixels']],'candidates':rank[:3],'verifiedMatchingImage':None,'note':'Candidates automatiques uniquement ; attribution après contrôle visuel.'}
save(OUT/'media-inventory.json',records)
items=[e for e in records if e.get('localPath')and e['type']=='image'and e['collection']!='portfolio-sheets']
review=OUT/'review';review.mkdir(exist_ok=True)
for start in range(0,len(items),12):
    sheet=Image.new('RGB',(1500,1200),'#eeeae1');d=ImageDraw.Draw(sheet)
    for j,e in enumerate(items[start:start+12]):
        x=(j%3)*500;y=(j//3)*300
        best=e['pdfComparison']['candidates'][0]
        for k,path in enumerate([ROOT/e['localPath'],ROOT/locations.get(best['src'],'public'+best['src'])]):
            with Image.open(path)as im:
                im=ImageOps.exif_transpose(im).convert('RGB');im.thumbnail((240,235));sheet.paste(im,(x+k*250,y+45))
        d.text((x+5,y+3),f"{e['id']} {e['width']}x{e['height']} | PDF p{best['sourcePage']}",fill='black')
        d.text((x+5,y+20),f"WEB / PDF - rms {best['rms64']} hash {best['dHashDistance']}",fill='black')
    sheet.save(review/f'comparison-{start:02d}.jpg',quality=85)
for start in range(0,32,16):
    sheets=[e for e in records if e['id'].startswith('portfolio-sheet-')][start:start+16]
    sheet=Image.new('RGB',(1400,1040),'#eeeeee');d=ImageDraw.Draw(sheet)
    for j,e in enumerate(sheets):
        with Image.open(ROOT/e['localPath'])as im:
            im.thumbnail((340,230));x=j%4*350;y=j//4*260;sheet.paste(im,(x,y+25));d.text((x+5,y+5),e['id'],fill='black')
    sheet.save(review/f'portfolio-sheets-{start:02d}.jpg',quality=85)
print(json.dumps({'images':len(items),'videos':[{k:e.get(k)for k in ['id','sha256','bytes','durationSeconds','width','height','videoAnalysis']}for e in records if e['type']=='video']},ensure_ascii=True))

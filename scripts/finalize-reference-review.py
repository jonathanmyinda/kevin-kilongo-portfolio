"""Manual visual-review decisions, kept separate from automatic similarity."""
from pathlib import Path
from hashlib import sha256
import json, shutil

ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/content/site-reference'
inventory=json.loads((OUT/'media-inventory.json').read_text(encoding='utf-8'))
projects=json.loads((ROOT/'src/data/projects.json').read_text(encoding='utf-8'))
by_number={p['number']:p for p in projects}
# Associations below were checked on side-by-side contact sheets, not inferred
# from nearest-image scores. Numbers with no decision remain unidentified.
mapping={2:13,3:15,5:9,6:8,7:8,8:8,9:7,11:12,14:7,23:16,24:16,25:16,30:5,32:2,33:2,34:2,35:2,36:4,37:4,39:1,40:1,41:1,42:1,43:1,44:1,45:1,46:1,47:1,48:4,49:1,50:4,51:4,52:2,53:3,54:3,55:3,56:3,57:1,59:1,60:1,61:1}
boards={39,40,41,43,44,45,46,47,49,57,60,61}
variants={2:'Vue supplémentaire de la rue : façades, clôtures et villa d’angle concordantes avec l’ensemble de villas.',5:'Même villa de Mont-Ngafula, cadrage et colorimétrie différents ; ne pas perdre le crédit OS’ARTS du PDF.',7:'Vue supplémentaire d’angle de Bandalungwa : volumes, baies et portique concordants.',8:'Même façade de Bandalungwa, ambiance/cadrage différents.',11:'Même arrivée de l’hôtel, cadrage plus large et teinte différente.',24:'Même immeuble Minimal House, vue de jour et teinte de façade différentes.',30:'Même jardin du centre oncologique, autre position de caméra : bâtiment, percements circulaires, arbres et gazebo concordants.',32:'Variante nocturne de KIMIA TOWER ; enseigne et balcons identifiables.',33:'Vue d’ensemble de jour de KIMIA TOWER ; enseigne, balcons et soubassement concordants.',35:'Vue d’ensemble nocturne de KIMIA TOWER ; enseigne et géométrie concordantes.',36:'Même bureau de direction, colorimétrie différente.',37:'Même espace de travail, colorimétrie différente.'}
for e in inventory:
    if not e.get('localPath'):continue
    e['publicDisplayEnabled']=False
    if e['collection']=='perspectives':
        n=int(e['id'].split('-')[1])
        if n in mapping:
            p=by_number[mapping[n]];e['projectId']=p['id'];e['projectSlug']=p['slug'];e['associationStatus']='visually-verified'
            e['credit']=p['agency'];e['creditBasis']='Agence du projet dans le PDF ; aucun nom d’auteur de prise de vue déduit.' if p['agency'] else 'Aucune agence déduite ; conserver les éventuels filigranes.'
            e['embeddedMarkings']='Fichier original conservé sans recadrage, effacement ni retouche de crédit.'
            if n==5:e['embeddedMarkings']='Le rendu du PDF porte OS’ARTS ; variante web avec cadrage/colorimétrie différents. Ne pas remplacer en perdant cette attribution.'
            if n in boards:
                e['assetKind']='presentation-board';e['usageRecommendation']='Archive RHOM CITY uniquement. Ne pas afficher la planche avec son texte en galerie ; conserver les visuels propres du PDF.'
                e['pdfComparison']['verifiedMatchingImage']=None
                e['pdfComparison']['verifiedSourcePages']=p['sourcePages']
                e['pdfComparison']['relationship']='Planche composite de contenu RHOM CITY, pas un visuel isolé équivalent au PDF.'
            else:
                e['assetKind']='render-3d';e['usageRecommendation']='Candidat pour enrichissement futur du projet, après optimisation et validation des crédits ; aucun remplacement automatique.'
                candidates=e['pdfComparison']['candidates'];best=candidates[0]
                # These are alternate cameras, not pixel-equivalent frames.
                alternate=n in {2,7,30,32,33,35}
                if not alternate and best['src'].split('/')[2]==p['slug']:
                    e['pdfComparison']['verifiedMatchingImage']=best['src']
                    e['pdfComparison']['verifiedSourcePages']=[best['sourcePage']]
                    e['pdfComparison']['pixelAreaRatio']=round(e['width']*e['height']/(best['width']*best['height']),3)
                    e['pdfComparison']['measuredSizeComparison']='more-pixels' if e['width']*e['height']>best['width']*best['height'] else 'same-pixels' if e['width']*e['height']==best['width']*best['height'] else 'fewer-pixels'
                else:e['pdfComparison']['verifiedSourcePages']=p['sourcePages']
                e['pdfComparison']['relationship']=variants.get(n,'Vue visuellement concordante avec un rendu du PDF ; cadrage/compression à comparer avant remplacement.')
                e['qualityNote']='Dimensions décodées du fichier, pas celles annoncées par le site. Plus de pixels ne prouve pas une meilleure netteté ; aucun agrandissement effectué.'
                if n in {3,7,8}:e['qualityNote']+=' Fichier PNG volumineux : export web optimisé à prévoir.'
            target=OUT/'media/projects'/p['slug']/Path(e['localPath']).name
        else:
            e['associationStatus']='unidentified';e['projectId']=None;e['credit']=None;e['assetKind']='video' if e['type']=='video' else 'render-3d'
            e['usageRecommendation']='Hors affichage public : nom, lieu, mission et agence à obtenir de Kevin. Une similarité automatique ne constitue pas une attribution.'
            e['qualityNote']='Conserver l’original et ses filigranes ; aucune affectation à un projet par ressemblance vague.'
            if n==31:e['candidateProjectIds']=['project-05'];e['associationNote']='Jardin/gazebo pouvant appartenir au centre oncologique, mais preuve visuelle insuffisante pour une attribution ferme.'
            target=OUT/'media/unidentified'/Path(e['localPath']).name
    elif e['collection']=='profile-services':
        e['associationStatus']='site-context';e['projectId']=None;e['credit']=None
        e['assetKind']='service-illustration' if e['id']=='service-conception' else 'site-work-photo' if e['id'].startswith('service-') else 'portrait'
        e['pdfComparison']['verifiedMatchingImage']=None;e['pdfComparison']['relationship']='Média complémentaire du profil/service, absent des 74 images isolées du PDF.'
        e['usageRecommendation']={'portrait-couleur':'Portrait couleur pour À propos ; présenté comme Kevin par le contexte de la page.', 'portrait-accueil':'Candidat d’accueil noir et blanc ; composition avec texte intégré, à conserver entière et à valider avant intégration.', 'portrait-meta':'Variante 800 px du portrait d’accueil ; préférer la version 2000 px si la composition et la netteté conviennent.', 'service-conception':'Illustration générique de plans, pas une réalisation de Kevin ; vérifier licence/origine avant réutilisation.', 'service-suivi':'Photographie de chantier issue du service Suivi ; ne pas la rattacher à un chantier nommé.', 'service-conseil':'Photographie sur chantier présentée dans le service Conseil ; ne pas déduire le nom ni la mission du chantier.'}[e['id']]
        target=OUT/'media/profile-services'/Path(e['localPath']).name
    else:
        e['associationStatus']='portfolio-archive';e['assetKind']='presentation-board';e['projectId']=None
        e['pdfComparison']['relationship']='Reproduction de planche du même portfolio, vérifiée visuellement ; non comparable directement à une image isolée.'
        if e['id'].startswith('portfolio-sheet-'):e['sourcePdfPage']=int(e['id'].split('-')[-1])
        target=OUT/'media/portfolio-sheets'/Path(e['localPath']).name
    source=(ROOT/e['localPath']).resolve();target=target.resolve()
    assert source.is_relative_to(OUT.resolve()) and target.is_relative_to(OUT.resolve())
    target.parent.mkdir(parents=True,exist_ok=True)
    if source!=target:
        if target.exists():assert sha256(source.read_bytes()).digest()==sha256(target.read_bytes()).digest()
        else:shutil.move(str(source),str(target))
    e['localPath']=target.relative_to(ROOT).as_posix()

def save(path,obj):path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
save(OUT/'media-inventory.json',inventory)
save(OUT/'unidentified-media.json',[e for e in inventory if e['associationStatus']=='unidentified'])
from collections import Counter
summary={'downloadedUrlCount':len(inventory),'imageUrlCount':sum(e['type']=='image'for e in inventory),'videoUrlCount':sum(e['type']=='video'for e in inventory),'totalBytes':sum(e['bytes']for e in inventory),'uniqueBinaryCount':len({e['sha256']for e in inventory}),'exactDuplicateUrlCount':sum(bool(e.get('exactDuplicateOf'))for e in inventory),'galleryUrlCount':61,'galleryUniqueBinaryCount':len({e['sha256']for e in inventory if e['collection']=='perspectives'}),'associationCounts':dict(Counter(e['associationStatus']for e in inventory)),'pdfExactByteDuplicateCount':sum(bool((e.get('pdfComparison')or{}).get('exactByteMatches'))for e in inventory),'pdfExactPixelDuplicateCount':sum(bool((e.get('pdfComparison')or{}).get('exactPixelMatches'))for e in inventory),'allPrivateFromApplication':all(not e['publicDisplayEnabled']for e in inventory)}
save(OUT/'summary.json',summary)
print(json.dumps(summary,ensure_ascii=True))

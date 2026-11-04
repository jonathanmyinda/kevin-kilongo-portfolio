// Real DEV fixtures and actual local/Preview endpoints. Never uses a human password.
import assert from 'node:assert/strict'
import {createServer,request as httpRequest} from 'node:http'
import https from 'node:https'
import {randomUUID,randomBytes,createHash} from 'node:crypto'
import {writeFileSync,mkdirSync,existsSync,unlinkSync} from 'node:fs'
import sharp from 'sharp'
import {PDFDocument} from 'pdf-lib'
import {Upload,DefaultHttpStack} from 'tus-js-client'
import {verifyTarget,sql,quote} from './dev-tools.mjs'
import {supabaseRequest} from '../server/admin/supabase.mjs'
import adminHandler from '../server/admin/handler.mjs'
import publicHandler from '../server/content/public.mjs'
import {previewOrigin,previewHTTP} from './preview-http.mjs'
verifyTarget()
const run=randomUUID(),slug='test-liaison-'+run,users=[],images=[],pdfs=[],checks=[]
const key=process.env.SUPABASE_DEV_SECRET_KEY,dir='node_modules/.cache/admin-public-link/'+run
mkdirSync(dir,{recursive:true});let cleaned=false,projectId,revisionId,cookie=''
const baseline=sql('select active_release_id,version,(select revision_id from portfolio.site_workspace) workspace from portfolio.site_state')[0]
assert(baseline.active_release_id,'Publication initiale requise')
const fingerprintQuery=`select jsonb_build_object('projects',(select jsonb_agg(to_jsonb(p)order by p.id)from portfolio.projects p),'revisions',(select jsonb_agg(to_jsonb(r)order by r.id)from portfolio.project_revisions r),'gallery',(select jsonb_agg(to_jsonb(g)order by g.revision_id,g.position)from portfolio.revision_media g)) content`
const fingerprint=JSON.stringify(sql(fingerprintQuery)[0].content)
const persist=()=>writeFileSync(dir+'/manifest.local.json',JSON.stringify({run,slug,baseline,users:users.map(u=>({id:u.id,email:u.email})),images,pdfs,checks,cleaned},null,2))
const check=(name,ok)=>{assert(ok,name);checks.push(name);persist();console.log('OK '+name)}
const server=createServer((req,res)=>new URL(req.url,'http://localhost').pathname==='/api/admin'?void adminHandler(req,res):void publicHandler(req,res))
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=previewOrigin||'http://127.0.0.1:'+server.address().port
if(!previewOrigin){process.env.PORTFOLIO_CONTENT_SOURCE='supabase-dev';process.env.ADMIN_ORIGIN=origin}
async function call(path,body,jar=cookie){
 const options={method:body===undefined?'GET':'POST',headers:{Origin:origin,Cookie:jar,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)}
 let result
 if(previewOrigin)result=await previewHTTP(path,options)
 else result=await new Promise((resolve,reject)=>{const bytes=options.body?Buffer.from(options.body):null;const req=httpRequest(origin+path,{method:options.method,agent:false,headers:{...options.headers,...(bytes?{'Content-Length':bytes.length}:{})}},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>{const raw=Buffer.concat(chunks);resolve({status:res.statusCode,data:res.headers['content-type']?.includes('application/json')?JSON.parse(raw):raw,cookies:res.headers['set-cookie']||[],headers:res.headers})})});req.setTimeout(120000,()=>req.destroy(Error('Délai local dépassé')));req.on('error',()=>reject(Error('API interrompue ; vérifier la mutation avant reprise')));req.end(bytes)})
 if(jar===cookie&&result.cookies.length)cookie=result.cookies.map(c=>c.split(';')[0]).join('; ')
 return result
}
const api=(action,body,id,jar)=>call('/api/admin?action='+action+(id?'&id='+id:''),body,jar)
const published=async()=>{const r=await call('/api/content',undefined,'');assert.equal(r.status,200,'Lecture publique');assert.equal(r.data.source,'supabase-dev');return r.data.content}
function tus(bytes,intent,bucket,mime){
 const signed=intent.uploadUrl?new URL(intent.uploadUrl):null
 const endpoint=intent.endpoint||process.env.SUPABASE_DEV_URL.replace('.supabase.co','.storage.supabase.co')+'/storage/v1/upload/resumable/sign'
 const objectKey=intent.objectKey||signed.pathname.split('/'+bucket+'/')[1],signature=intent.signature||signed.searchParams.get('token')
 return new Promise((resolve,reject)=>{let timer;const upload=new Upload(bytes,{endpoint,httpStack:new DefaultHttpStack({family:4,agent:false}),uploadSize:bytes.length,headers:{apikey:process.env.SUPABASE_DEV_PUBLISHABLE_KEY,'x-signature':signature},metadata:{bucketName:bucket,objectName:objectKey,contentType:mime,cacheControl:'0'},chunkSize:6*1024**2,uploadDataDuringCreation:true,storeFingerprintForResuming:false,retryDelays:[0,1000,3000],onSuccess:()=>{clearTimeout(timer);resolve()},onError:e=>{clearTimeout(timer);const err=Error('Storage a refusé ou interrompu le transfert');err.status=e.originalResponse?.getStatus();err.sizeError=/size|large|exceed|limit/i.test(e.originalResponse?.getBody()||'');reject(err)}});timer=setTimeout(()=>{void upload.abort(false);reject(Error('Délai transfert dépassé'))},180000);upload.start()})
}
function download(url,range){assert(url.startsWith(process.env.SUPABASE_DEV_URL+'/storage/v1/object/sign/portfolio-private/'),'Destination signée vérifiée');return new Promise((resolve,reject)=>{const req=https.get(url,{family:4,agent:false,headers:range?{Range:range}:{}},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve({status:res.statusCode,bytes:Buffer.concat(chunks),headers:res.headers}));res.on('error',()=>reject(Error('Lecture média interrompue')))});req.setTimeout(60000,()=>req.destroy());req.on('error',()=>reject(Error('Téléchargement interrompu')))})}
try{
 const initial=await published();check('18 projets initiaux publiés, fixture personnelle exclue',initial.projects.length===18&&!initial.projects.some(p=>p.slug==='test-editeur-administration'))
 check('profil services portraits contacts et PDF issus de la publication',initial.profile.name==='Kevin Kilongo Munganga'&&initial.services.length===4&&initial.profile.heroPortrait.id!==initial.profile.portrait.id&&initial.profile.portfolio.bytes===9515589&&initial.contactLinks.phone==='https://wa.me/243813732058')
 check('projection publique sans archive ni clés de stockage',!/("internal"|"sourcePages"|"object_key"|"legacyPath"|"homeSource")/.test(JSON.stringify(initial)))
 check('historique refusé sans administrateur',(await api('project-history',undefined,randomUUID(),'')).status===401)
 for(const role of ['admin','nonadmin']){const email='link-'+role+'-'+run+'@example.invalid',password=randomBytes(24).toString('hex');const r=await supabaseRequest('/auth/v1/admin/users',{method:'POST',key,body:{email,password,email_confirm:true}});assert.equal(r.status,200);users.push({id:r.data.id,email,password});persist()}
 sql(`insert into portfolio.admin_members(user_id)values(${quote(users[0].id)});`)
 assert.equal((await api('login',{email:users[0].email,password:users[0].password})).status,200)
 const other=await supabaseRequest('/auth/v1/token?grant_type=password',{method:'POST',body:{email:users[1].email,password:users[1].password}}),nonadmin='portfolio_access='+other.data.access_token
 check('dépublication refusée aux comptes non administrateurs',(await api('unpublish',{projectId:randomUUID(),expectedVersion:1},undefined,nonadmin)).status===403)
 const png=await sharp({create:{width:320,height:180,channels:3,background:'#278776'}}).png().toBuffer();writeFileSync(dir+'/image-liaison.png',png)
 const begin=await api('image-begin',{name:'image-liaison.png',mime:'image/png',bytes:png.length});assert.equal(begin.status,200);const image=begin.data;images.push({id:image.id,incomingKey:new URL(image.uploadUrl).pathname.split('/portfolio-incoming/')[1]});persist()
 await tus(png,image,'portfolio-incoming','image/png');const ready=await api('image-finish',{id:image.id});assert.equal(ready.status,200)
 check('image importée et validée après refonte',ready.data.width===320&&ready.data.height===180)
 check('média validé mais non publié inaccessible au public',(await call('/api/media?id='+image.id,undefined,'')).status===404)
 const data={slug,title:'TEST Liaison '+run,description:'Contenu fictif de recette',category:'Test',location:null,mission:'Vérification technique',agency:'Crédit de test',context:'Fixture isolée',images:[{id:image.id,alt:'Rectangle de test turquoise',caption:'Légende de test',credit:'Fixture technique',cover:true,position:0}]}
 let r=await api('save',{projectId:null,expectedRevision:null,data});assert.equal(r.status,200);revisionId=r.data.revisionId;let catalog=(await api('projects')).data;projectId=catalog.projects.find(p=>p.revisionId===revisionId).id
 check('brouillon invisible au portfolio de Preview',!(await published()).projects.some(p=>p.slug===slug))
 const preview=await api('preview',undefined,revisionId),binary=await api('media',undefined,image.id)
 check('aperçu privé et image réellement décodable',preview.data.images[0].id===image.id&&binary.status===200&&(await sharp(binary.data).metadata()).format==='webp')
 r=await api('publish',{projectId,revisionId,siteId:catalog.siteId,expectedVersion:catalog.version});assert.equal(r.status,200)
 check('publication visible dans la lecture du portfolio', (await published()).projects.some(p=>p.slug===slug&&p.title===data.title))
 const link=await call('/api/media?id='+image.id,undefined,'');check('média publié délivré par lien temporaire',link.status===307)
 const firstToken=new URL(link.headers.location).searchParams.get('token'),claims=JSON.parse(Buffer.from(firstToken.split('.')[1],'base64url'));check('lien média limité à 120 secondes',claims.exp-Date.now()/1000>60&&claims.exp-Date.now()/1000<=125)
 await new Promise(r=>setTimeout(r,1100));const renewed=await call('/api/media?id='+image.id,undefined,'');check('nouvelle demande renouvelle le lien sans URL périmée stockée',renewed.status===307&&new URL(renewed.headers.location).searchParams.get('token')!==firstToken)
 const privateDraft={...data,title:'Brouillon privé '+run};r=await api('save',{projectId,expectedRevision:revisionId,data:privateDraft});assert.equal(r.status,200);revisionId=r.data.revisionId
 check('modification non publiée conserve l’ancienne version publique',(await published()).projects.find(p=>p.slug===slug).title===data.title)
 catalog=(await api('projects')).data;r=await api('unpublish',{projectId,expectedVersion:catalog.version});assert.equal(r.status,200)
 check('dépublication absente du catalogue et des sélections',!(await published()).projects.some(p=>p.slug===slug)&&!(await published()).featuredProjects.some(p=>p.slug===slug))
 check('média dépublié refusé aux nouvelles demandes',(await call('/api/media?id='+image.id,undefined,'')).status===404)
 const history=(await api('project-history',undefined,projectId)).data;assert.equal(history.length,1);catalog=(await api('projects')).data
 r=await api('restore-project',{projectId,revisionId:history[0].revisionId,expectedVersion:catalog.version});assert.equal(r.status,200)
 check('restauration retrouve la publication précédente',(await published()).projects.find(p=>p.slug===slug).title===data.title)
 check('restauration conserve le brouillon modifié',(await api('projects')).data.projects.find(p=>p.id===projectId).data.title===privateDraft.title)
 check('conflit de restauration HTTP 409',(await api('restore-project',{projectId,revisionId:history[0].revisionId,expectedVersion:catalog.version})).status===409)
 const pdf=await PDFDocument.create();pdf.addPage().drawText('Test technique portfolio');const pdfBytes=Buffer.from(await pdf.save());writeFileSync(dir+'/portfolio-liaison.pdf',pdfBytes)
 r=await api('pdf-begin',{name:'portfolio-liaison.pdf',bytes:pdfBytes.length});assert.equal(r.status,200);const intent=r.data;pdfs.push({id:intent.id,incomingKey:intent.objectKey});persist();await tus(pdfBytes,intent,'portfolio-pdf-incoming','application/pdf');r=await api('pdf-finish',{id:intent.id});assert.equal(r.status,200)
 check('PDF réel importé et validé après refonte',r.data.pages===1)
 const pdfLink=await api('pdf-link',{id:intent.id,downloadName:'test-liaison.pdf'});assert.equal(pdfLink.status,200);const fetched=await download(pdfLink.data.downloadUrl)
 check('aperçu privé et téléchargement PDF inchangé',fetched.status===200&&createHash('sha256').update(fetched.bytes).digest('hex')===createHash('sha256').update(pdfBytes).digest('hex')&&fetched.headers['content-disposition'].includes('test-liaison.pdf'))
 check('PDF privé non publié absent de l’API publique',(await call('/api/media?id='+intent.id,undefined,'')).status===404)
 const current=(await published()).profile.portfolio.src,publicPDF=await call(current,undefined,'');assert.equal(publicPDF.status,307);const head=await download(publicPDF.headers.location,'bytes=0-1023')
 check('PDF publié accessible en téléchargement depuis la Preview',head.status===206&&head.bytes.subarray(0,5).toString()==='%PDF-'&&head.headers['content-disposition'].includes('portfolio-kevin-kilongo-munganga.pdf'))
 const big=Buffer.alloc(6*1024**2+1);png.copy(big)
 r=await api('image-begin',{name:'hors-limite.png',mime:'image/png',bytes:png.length});assert.equal(r.status,200);const oversize=r.data;images.push({id:oversize.id,incomingKey:new URL(oversize.uploadUrl).pathname.split('/portfolio-incoming/')[1]});persist()
 let denied=false;try{await tus(big,oversize,'portfolio-incoming','image/png')}catch(e){denied=e.status===413&&e.sizeError}
 check('refus direct réel de Storage pour une image supérieure à 6 Mio',denied)
 if(process.argv.includes('--hold')){
  writeFileSync(dir+'/credentials.local.json',JSON.stringify({email:users[0].email,password:users[0].password,slug,dir}));console.log('Recette prête pour contrôle UI : '+dir)
  const until=Date.now()+20*60*1000;while(!existsSync(dir+'/continue.local')&&Date.now()<until)await new Promise(r=>setTimeout(r,500))
 }
}catch(e){console.log('Recette liaison interrompue : '+e.message);throw e}finally{
 await new Promise(r=>server.close(r))
 const actors=users.map(u=>quote(u.id)).join(',')||'null',releases=sql(`select id from portfolio.releases where created_by in(${actors})`).map(r=>quote(r.id)).join(',')||'null'
 // Include additional browser uploads by this run's disposable actor only.
 const imageFiles=sql(`select id,incoming_key,final_key from portfolio.image_imports where actor in(${actors})`),pdfFiles=sql(`select id,incoming_key,final_key from portfolio.pdf_imports where actor in(${actors})`),allMedia=[...imageFiles,...pdfFiles].map(f=>quote(f.id)).join(',')||'null'
 sql(`begin;do $$ begin if (select active_release_id from portfolio.site_state)<>${quote(baseline.active_release_id)}::uuid and not exists(select 1 from portfolio.site_state where active_release_id in(${releases})) then raise exception 'Publication tierce : arrêt';end if;end $$;
 update portfolio.site_state set active_release_id=${quote(baseline.active_release_id)},version=${Number(baseline.version)} where active_release_id in(${releases});
 delete from portfolio.publication_events where release_id in(${releases});delete from portfolio.release_projects where release_id in(${releases});delete from portfolio.releases where id in(${releases});
 delete from portfolio.project_workspaces where project_id in(select id from portfolio.projects where slug=${quote(slug)});delete from portfolio.revision_media where revision_id in(select r.id from portfolio.project_revisions r join portfolio.projects p on p.id=r.project_id where p.slug=${quote(slug)});delete from portfolio.project_revisions where project_id in(select id from portfolio.projects where slug=${quote(slug)});delete from portfolio.projects where slug=${quote(slug)};
 delete from portfolio.image_imports where actor in(${actors});delete from portfolio.pdf_imports where actor in(${actors});delete from portfolio.media where id in(${allMedia});commit;`)
 for(const [bucket,paths]of[['portfolio-incoming',imageFiles.map(x=>x.incoming_key)],['portfolio-pdf-incoming',pdfFiles.map(x=>x.incoming_key)],['portfolio-private',[...imageFiles,...pdfFiles].map(x=>x.final_key)]])if(paths.length)assert((await supabaseRequest('/storage/v1/object/'+bucket,{method:'DELETE',key,body:{prefixes:paths}})).status<300)
 for(const u of users){sql(`delete from portfolio.admin_members where user_id=${quote(u.id)}`);assert((await supabaseRequest('/auth/v1/admin/users/'+u.id,{method:'DELETE',key})).status<300)}
 if(existsSync(dir+'/credentials.local.json'))unlinkSync(dir+'/credentials.local.json')
 assert.equal(JSON.stringify(sql(fingerprintQuery)[0].content),fingerprint,'Contenus préexistants intégralement préservés');cleaned=true;persist();console.log('Fixtures de liaison nettoyées ; publication initiale et modifications préexistantes préservées.')
}
console.log(checks.length+' contrôles réels de liaison réussis.')

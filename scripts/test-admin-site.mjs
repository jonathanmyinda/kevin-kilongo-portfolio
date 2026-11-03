// Real Auth/API/direct signé/Storage test, pinned DEV. Restores initial profile/public state.
import assert from 'node:assert/strict'
import {createServer,request as http} from 'node:http'
import https from 'node:https'
import {randomUUID,randomBytes,createHash} from 'node:crypto'
import {readFileSync,writeFileSync} from 'node:fs'
import sharp from 'sharp'
import {Upload,DefaultHttpStack} from 'tus-js-client'
import {PDFDocument} from 'pdf-lib'
import {verifyTarget,sql,quote} from './dev-tools.mjs'
import {supabaseRequest} from '../server/admin/supabase.mjs'
import {siteFields} from '../server/admin/site.mjs'
import {createAdminHandler} from '../server/admin/handler.mjs'
verifyTarget()
const run=randomUUID(),slug='site-fixture-'+run,users=[],pdfs=[],revisions=[],releases=[],uploads=[],checks=[]
const key=process.env.SUPABASE_DEV_SECRET_KEY,manifest='node_modules/.cache/admin-workflow/site-'+run+'.local.json'
let cleaned=false
const persist=()=>writeFileSync(manifest,JSON.stringify({run,slug,baseline,cleaned,users:users.map(u=>u.id),pdfs:pdfs.map(p=>({id:p.id,objectKey:p.objectKey})),revisions,releases,checks},null,2))
const fingerprintSQL="select jsonb_build_object('projects',(select jsonb_agg(to_jsonb(p)order by p.id)from portfolio.projects p where legacy_id is not null),'revisions',(select jsonb_agg(to_jsonb(r)order by r.id)from portfolio.project_revisions r join portfolio.projects p on p.id=r.project_id where p.legacy_id is not null),'gallery',(select jsonb_agg(to_jsonb(g)order by g.revision_id,g.position)from portfolio.revision_media g join portfolio.project_revisions r on r.id=g.revision_id join portfolio.projects p on p.id=r.project_id where p.legacy_id is not null)) content"
const before=JSON.stringify(sql(fingerprintSQL)[0].content)
const baseline=sql('select active_release_id,version,(select revision_id from portfolio.site_workspace) workspace from portfolio.site_state')[0]
const server=createServer(createAdminHandler(async(path,options)=>{
 const result=await supabaseRequest(path,options)
 if(path==='/rest/v1/rpc/admin_save_site'&&result.status>=400)console.log('Diagnostic SQL de fixture : '+JSON.stringify({code:result.data?.code,message:result.data?.message}))
 return result
}));await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`
let cookie='',projectId,firstSite,secondSite
function api(action,body,id,jar=cookie){return new Promise((resolve,reject)=>{
 const bytes=body===undefined?null:Buffer.from(JSON.stringify(body))
 const req=http(origin+'/api/admin?action='+action+(id?'&id='+id:''),{method:bytes?'POST':'GET',agent:false,headers:{Origin:origin,Cookie:jar,...(bytes?{'Content-Type':'application/json','Content-Length':bytes.length}:{})}},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>{if(jar===cookie&&res.headers['set-cookie'])cookie=res.headers['set-cookie'].map(c=>c.split(';')[0]).join('; ');const raw=Buffer.concat(chunks);resolve({status:res.statusCode,data:res.headers['content-type']?.includes('application/json')?JSON.parse(raw.toString()):raw})})})
 req.setTimeout(120000,()=>req.destroy(Error('Délai API dépassé')));req.on('error',reject);if(bytes)req.write(bytes);req.end()
})}
const check=(label,condition)=>{assert(condition,label);checks.push(label);console.log('OK '+label);persist()}
const rpc=(name,body={})=>supabaseRequest('/rest/v1/rpc/'+name,{method:'POST',body})
const editable=d=>Object.fromEntries(siteFields.map(k=>[k,structuredClone(d[k])]))
const safeDetail=value=>String(value||'').replace(/https?:\S+/g,'[URL]').replace(/[A-Za-z0-9_-]{40,}/g,'[masqué]').slice(0,500)
async function begin(bytes,name){const r=await api('pdf-begin',{name,bytes:bytes.length});assert.equal(r.status,200,'Autorisation PDF');pdfs.push(r.data);persist();return r.data}
function transfer(intent,bytes){return new Promise((resolve,reject)=>{
 let timer
 const upload=new Upload(bytes,{endpoint:intent.endpoint,httpStack:new DefaultHttpStack({family:4,agent:false}),uploadSize:bytes.length,headers:{apikey:intent.publishableKey,'x-signature':intent.signature},metadata:{bucketName:intent.bucket,objectName:intent.objectKey,contentType:'application/pdf',cacheControl:'0'},chunkSize:6*1024**2,uploadDataDuringCreation:true,storeFingerprintForResuming:false,removeFingerprintOnSuccess:true,retryDelays:[0,1000,3000,5000],onSuccess:()=>{clearTimeout(timer);resolve()},onError:e=>{clearTimeout(timer);const detail=safeDetail(e.originalResponse?.getBody());console.log('Diagnostic transfert : '+JSON.stringify({status:e.originalResponse?.getStatus(),detail}));const error=Error('Transfert PDF refusé ou interrompu');error.status=e.originalResponse?.getStatus();error.detail=detail;reject(error)}})
 timer=setTimeout(()=>{void upload.abort(false);reject(Error('Délai du transfert dépassé'))},180000);uploads.push(upload);upload.start()
})}
function download(url){return new Promise((resolve,reject)=>{const req=https.get(url,{family:4,agent:false},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve({status:res.statusCode,bytes:Buffer.concat(chunks),disposition:res.headers['content-disposition']}))});req.setTimeout(45000,()=>req.destroy(Error('Téléchargement interrompu')));req.on('error',()=>reject(Error('Accès privé PDF interrompu')))})}
try{
 check('profil anonyme refusé',(await api('site')).status===401)
 check('aperçu profil anonyme refusé',(await api('site-preview',undefined,randomUUID())).status===401)
 check('transfert PDF anonyme refusé',(await api('pdf-begin',{name:'test.pdf',bytes:100})).status===401)
 for(const role of ['admin','nonadmin']){const email=`site-${role}-${run}@example.invalid`,password=randomBytes(24).toString('hex');const r=await supabaseRequest('/auth/v1/admin/users',{method:'POST',key,body:{email,password,email_confirm:true}});assert.equal(r.status,200);users.push({id:r.data.id,email,password});persist()}
 sql(`insert into portfolio.admin_members(user_id)values(${quote(users[0].id)});`)
 const other=await supabaseRequest('/auth/v1/token?grant_type=password',{method:'POST',body:{email:users[1].email,password:users[1].password}}),otherCookie='portfolio_access='+other.data.access_token
 check('profil non administrateur refusé',(await api('site',undefined,undefined,otherCookie)).status===403)
 check('PDF non administrateur refusé',(await api('pdf-begin',{name:'x.pdf',bytes:100},undefined,otherCookie)).status===403)
 check('service PDF privilégié refusé au JWT utilisateur',(await supabaseRequest('/rest/v1/rpc/service_pdf',{method:'POST',token:other.data.access_token,body:{p_action:'claim',p_id:randomUUID(),p_actor:users[1].id}})).status>=400)
 assert.equal((await api('login',{email:users[0].email,password:users[0].password})).status,200)
 if(process.argv.includes('--pdf-only')){
 const smallDoc=await PDFDocument.create();smallDoc.addPage().drawText('PDF fictif');const smallBytes=Buffer.from(await smallDoc.save()),small=await begin(smallBytes,'petit-test.pdf');await transfer(small,smallBytes);check('petit PDF transféré et validé',(await api('pdf-finish',{id:small.id})).data.pages===1)
 const bytes=readFileSync('public/documents/portfolio-kevin-kilongo-munganga.pdf'),valid=await begin(bytes,'portfolio-valide.pdf');await transfer(valid,bytes);check('transfert direct signé réel de 9,52 Mo terminé',true);const finish=await api('pdf-finish',{id:valid.id});assert.equal(finish.status,200);check('PDF réel validé 32 pages',finish.data.pages===32)
 }else{
 const initial=(await api('site')).data,sourceMedia=JSON.parse(readFileSync('src/data/published-media.json','utf8'))
 const paths=sql(`select id,legacy_path from portfolio.media where id in(${quote(initial.data.heroMediaId)},${quote(initial.data.portraitMediaId)});`)
 check('deux derniers portraits préremplis séparément',paths.find(p=>p.id===initial.data.heroMediaId).legacy_path===sourceMedia.heroPortrait.src&&paths.find(p=>p.id===initial.data.portraitMediaId).legacy_path===sourceMedia.portrait.src&&initial.data.heroMediaId!==initial.data.portraitMediaId)
 check('services et ancien PDF préremplis',initial.data.services.length===4&&initial.data.pdf.bytes===9515589&&initial.data.pdf.pages===32)
 const baselinePublic=(await rpc('read_portfolio')).data
 const pre=await api('site-save',{expectedRevision:initial.revisionId,data:{...editable(initial.data),name:'Brouillon profil privé '+run}});assert.equal(pre.status,200);revisions.push(pre.data.revisionId);persist()
 const catalog=(await api('projects')).data,source=catalog.projects.find(p=>p.legacyId==='project-01').data
 check('catalogue utilise le profil initial et non le brouillon',catalog.siteId!==pre.data.revisionId)
 const project={slug,title:'Projet publié de test',description:'Fixture',category:'Test',location:null,mission:'Mission fictive',agency:null,context:'Test technique',images:source.images.map((i,position)=>({id:i.id,alt:i.alt,caption:i.caption,credit:i.credit,cover:i.cover,position}))}
 const created=await api('save',{projectId:null,expectedRevision:null,data:project});assert.equal(created.status,200)
 let projects=(await api('projects')).data;projectId=projects.projects.find(p=>p.revisionId===created.data.revisionId).id
 const pubProject=await api('publish',{projectId,revisionId:created.data.revisionId,siteId:projects.siteId,expectedVersion:projects.version});assert.equal(pubProject.status,200);releases.push(pubProject.data.releaseId);persist()
 assert.equal((await api('save',{projectId,expectedRevision:created.data.revisionId,data:{...project,title:'Brouillon projet à ne pas publier'}})).status,200)
 const projectPublication=(await rpc('read_portfolio')).data,publicBefore=JSON.stringify(projectPublication)
 check('publication projet ne publie pas le brouillon du profil',projectPublication.profile.name===(baselinePublic?.profile.name||initial.data.name))
 const first={...editable(initial.data),name:'TEST profil '+run,email:'fixture@example.invalid',phone:'+243 812 000 000',headline:'Accroche fictive',subtitle:'Sous-titre fictif',presentation:'Présentation de test',approach:'Démarche de test',heroMediaId:initial.data.portraitMediaId,portraitMediaId:initial.data.heroMediaId,services:[...initial.data.services].reverse(),socials:[{label:'Test',url:'https://example.invalid/@test'}]}
 const badLink=await api('site-save',{expectedRevision:pre.data.revisionId,data:{...first,socials:[{label:'Interdit',url:'javascript:alert(1)'}]}})
 check('protocole social dangereux refusé',badLink.status===400&&badLink.data.error.includes('HTTPS'))
 const one=await api('site-save',{expectedRevision:pre.data.revisionId,data:first});assert.equal(one.status,200,'Sauvegarde profil : '+(one.data.error||''));firstSite=one.data.revisionId;revisions.push(firstSite);persist()
 check('édition profil sans effet sur publication',JSON.stringify((await rpc('read_portfolio')).data)===publicBefore)
 const reloaded=(await api('site')).data
 check('profil services ordre et crédits rechargés',reloaded.revisionId===firstSite&&reloaded.data.name===first.name&&JSON.stringify(reloaded.data.services)===JSON.stringify(first.services))
 const preview=await api('site-preview',undefined,firstSite)
 check('aperçu fidèle des deux portraits et services',preview.data.heroMediaId===first.heroMediaId&&preview.data.portraitMediaId===first.portraitMediaId&&preview.data.services[0].title===first.services[0].title)
 check('liens WhatsApp et mailto construits',preview.data.contactLinks.whatsapp==='https://wa.me/243812000000'&&decodeURIComponent(preview.data.contactLinks.email)==='mailto:fixture@example.invalid')
 for(const id of [first.heroMediaId,first.portraitMediaId,...first.services.map(s=>s.mediaId).filter(Boolean)]){const r=await api('media',undefined,id);assert.equal(r.status,200);assert((await sharp(r.data).metadata()).width>0)}check('portraits et photographies de services réellement lisibles',true)
 const p1=await api('site-publish',{revisionId:firstSite,expectedVersion:reloaded.version});assert.equal(p1.status,200);releases.push(p1.data.releaseId);persist()
 check('publication profil conserve version publiée du projet',(await rpc('read_portfolio')).data.projects.find(p=>p.slug===slug).title===project.title)
 check('aucun brouillon projet publié implicitement',JSON.stringify((await rpc('read_portfolio')).data.projects.map(p=>p.slug).sort())===JSON.stringify([...(baselinePublic?.projects||[]).map(p=>p.slug),slug].sort()))
 check('PDF surdimensionné refusé à l’admission',(await api('pdf-begin',{name:'trop-grand.pdf',bytes:20971521})).status===413)
 const oversized=await begin(Buffer.alloc(1),'limite.pdf');let refusal
 try{await transfer(oversized,Buffer.alloc(20971521));refusal=null}catch(e){refusal=e}
 check('limite réelle Storage PDF de 20 Mio',refusal?.status>=400&&/size|large|exceed|limit/i.test(refusal.detail||''))
 const bytes=readFileSync('public/documents/portfolio-kevin-kilongo-munganga.pdf'),valid=await begin(bytes,'portfolio-valide.pdf')
 await transfer(valid,bytes);check('transfert direct signé de 9,52 Mo terminé',true)
 const noRead=await supabaseRequest('/storage/v1/object/public/portfolio-pdf-incoming/'+valid.objectKey)
 check('PDF en attente non public',noRead.status>=400)
 const finish=await api('pdf-finish',{id:valid.id});assert.equal(finish.status,200,'Validation complète PDF')
 check('PDF valide analysé 32 pages avec poids réel',finish.data.pages===32&&finish.data.bytes===9515589)
 const filename='portfolio-test-technique.pdf',link=await api('pdf-link',{id:valid.id,downloadName:filename});assert.equal(link.status,200)
 check('lien PDF privé refusé sans session',(await api('pdf-link',{id:valid.id},undefined,'')).status===401)
 const fetched=await download(link.data.downloadUrl)
 check('téléchargement privé inchangé avec nom adapté',fetched.status===200&&fetched.disposition?.includes(filename)&&createHash('sha256').update(fetched.bytes).digest('hex')===createHash('sha256').update(bytes).digest('hex'))
 const current=(await api('site')).data
 const second={...first,subtitle:'Texte privé non publié '+run,pdfMediaId:valid.id,pdfDownloadName:filename,services:[...first.services,{title:'Service fictif supplémentaire',description:'Vérification ajout et retrait',mediaId:null,alt:null,credit:null}]}
 const two=await api('site-save',{expectedRevision:firstSite,data:second});assert.equal(two.status,200);secondSite=two.data.revisionId;revisions.push(secondSite);persist()
 const during=(await rpc('read_portfolio')).data
 check('ancien PDF et profil publiés disponibles pendant édition',during.profile.pdfMediaId===initial.data.pdfMediaId&&during.profile.subtitle===first.subtitle)
 check('nouveau brouillon absent des réponses publiques',!JSON.stringify(during).includes('Texte privé non publié'))
 check('nouveau PDF dans aperçu privé',(await api('site-preview',undefined,secondSite)).data.pdf.id===valid.id)
 const p2=await api('site-publish',{revisionId:secondSite,expectedVersion:current.version});assert.equal(p2.status,200);releases.push(p2.data.releaseId);persist()
 check('publication explicite du nouveau PDF',(await rpc('read_portfolio')).data.profile.pdfMediaId===valid.id)
 check('conflit de publication HTTP 409',(await api('site-publish',{revisionId:secondSite,expectedVersion:current.version})).status===409)
 check('PDF référencé non supprimable',(await api('pdf-delete',{id:valid.id,confirm:true})).status===409)
 const history=(await api('site')).data
 const restore=await api('site-restore',{revisionId:firstSite,expectedVersion:history.version});assert.equal(restore.status,200);releases.push(restore.data.releaseId);persist()
 const restored=(await rpc('read_portfolio')).data
 check('restauration du profil services et ancien PDF',restored.profile.pdfMediaId===initial.data.pdfMediaId&&restored.profile.subtitle===first.subtitle&&JSON.stringify(restored.services)===JSON.stringify(first.services))
 check('restauration ne change pas le projet publié',restored.projects.find(p=>p.slug===slug).title===project.title)
 check('restauration conserve le brouillon courant',(await api('site')).data.revisionId===secondSite)
 const fakeBytes=Buffer.from('%PDF-1.7\nceci est un faux PDF\n%%EOF\n'),fake=await begin(fakeBytes,'faux.pdf');await transfer(fake,fakeBytes)
 check('faux PDF réellement refusé après upload',(await api('pdf-finish',{id:fake.id})).status===422)
 check('échec PDF ne modifie pas le brouillon',(await api('site')).data.revisionId===secondSite)
 }
}catch(error){console.log('Recette interrompue : '+error.message);throw error}finally{
 await new Promise(r=>server.close(r))
 const ownReleases=releases.length?releases.map(quote).join(','):'null',ownSites=revisions.length?revisions.map(quote).join(','):'null',ownPDFs=pdfs.length?pdfs.map(p=>quote(p.id)).join(','):'null'
 sql(`begin;
 do $$ begin if (select active_release_id from portfolio.site_state) is distinct from ${baseline.active_release_id?quote(baseline.active_release_id)+'::uuid':'null::uuid'} and not exists(select 1 from portfolio.site_state where active_release_id in(${ownReleases})) then raise exception 'Publication tierce : arrêt'; end if; if (select revision_id from portfolio.site_workspace) is distinct from ${quote(baseline.workspace)}::uuid and not exists(select 1 from portfolio.site_workspace where revision_id in(${ownSites})) then raise exception 'Brouillon tiers : arrêt'; end if; end $$;
 update portfolio.site_state set active_release_id=${baseline.active_release_id?quote(baseline.active_release_id):'null'},version=${Number(baseline.version)} where active_release_id in(${ownReleases});update portfolio.site_workspace set revision_id=${quote(baseline.workspace)} where revision_id in(${ownSites});
 delete from portfolio.publication_events where release_id in(${ownReleases});delete from portfolio.release_projects where release_id in(${ownReleases});delete from portfolio.releases where id in(${ownReleases});
 delete from portfolio.project_workspaces where project_id in(select id from portfolio.projects where slug=${quote(slug)});delete from portfolio.revision_media where revision_id in(select r.id from portfolio.project_revisions r join portfolio.projects p on p.id=r.project_id where p.slug=${quote(slug)});delete from portfolio.project_revisions where project_id in(select id from portfolio.projects where slug=${quote(slug)});delete from portfolio.projects where slug=${quote(slug)};
 delete from portfolio.services where site_revision_id in(${ownSites});delete from portfolio.social_links where site_revision_id in(${ownSites});delete from portfolio.site_revisions where id in(${ownSites});delete from portfolio.pdf_imports where id in(${ownPDFs});delete from portfolio.media where id in(${ownPDFs});commit;`)
 for(const upload of uploads)if(upload.url){try{await upload.abort(true)}catch{/* Completed resources are expired by Storage; exact files are deleted below. */}}
 for(const [bucket,paths]of [['portfolio-pdf-incoming',pdfs.map(p=>p.objectKey)],['portfolio-private',pdfs.map(p=>`uploads/${p.id}/${p.id}.pdf`)]])if(paths.length)assert((await supabaseRequest('/storage/v1/object/'+bucket,{method:'DELETE',key,body:{prefixes:paths}})).status<300)
 for(const u of users){sql(`delete from portfolio.admin_members where user_id=${quote(u.id)};`);assert((await supabaseRequest('/auth/v1/admin/users/'+u.id,{method:'DELETE',key})).status<300)}
 assert.equal(JSON.stringify(sql(fingerprintSQL)[0].content),before,'18 projets importés préservés')
 cleaned=true;persist();console.log('Fixtures nettoyées ; brouillon initial et publication restaurés, 18 projets et compte personnel préservés.')
}
console.log(`${checks.length} contrôles réels profil/services/PDF réussis.`)

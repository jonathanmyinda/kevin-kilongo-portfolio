// HISTORICAL pre-quarantine suite: requires an empty DB and the former direct
// final-bucket admin upload policy. Use test-admin-images.mjs for current rules.
// Hard-pinned development project, own fixtures only.
import assert from 'node:assert/strict'
import https from 'node:https'
import {randomUUID,randomBytes,createHash} from 'node:crypto'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
const ref='pahbwurduwagdglpslos',base=`https://${ref}.supabase.co`
const env={};for(const line of readFileSync('.env.supabase-dev.local','utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2')}
assert.equal(env.SUPABASE_DEV_PROJECT_REF,ref);assert.equal(env.SUPABASE_DEV_PROJECT_NAME,'kevin-portfolio-dev');assert.equal(env.SUPABASE_DEV_REGION,'eu-west-1');assert.equal(env.SUPABASE_DEV_URL,base)
assert(env.SUPABASE_DEV_SECRET_KEY?.startsWith('sb_secret_'));assert(env.SUPABASE_DEV_PUBLISHABLE_KEY?.startsWith('sb_publishable_'))
const run=randomUUID(),ids=Object.fromEntries(['project','revision','draft','site','image','pdf'].map(k=>[k,randomUUID()])),users=[],objects=[],checks=[]
const dir='node_modules/.cache/admin-dev-tests';mkdirSync(dir,{recursive:true});const manifest=`${dir}/api-${run}.local.json`
function persist(extra={}){writeFileSync(manifest,JSON.stringify({ref,run,ids,users:users.map(({id,role})=>({id,role})),objects,checks,...extra},null,2))}
function cli(args){const r=spawnSync(process.execPath,['node_modules/supabase/dist/supabase.js',...args,'--output','json'],{encoding:'utf8',maxBuffer:3000000});if(r.status!==0){writeFileSync(`${dir}/failure-${run}.local.txt`,r.stdout+r.stderr);throw Error('CLI opération refusée ; diagnostic local conservé')}return JSON.parse(r.stdout)}
const target=cli(['projects','list']).find(p=>p.id===ref);assert.equal(target.name,'kevin-portfolio-dev');assert.equal(target.region,'eu-west-1')
function sql(text){const file=`${dir}/query-${run}.sql`;writeFileSync(file,text);return cli(['db','query','--linked','--project-ref',ref,'--file',file]).rows}
function api(path,{method='GET',token,privileged=false,body,mime}={}){return new Promise((resolve,reject)=>{
 const bytes=body===undefined?null:Buffer.isBuffer(body)?body:Buffer.from(JSON.stringify(body));
 const req=https.request(new URL(path,base),{method,family:4,headers:{apikey:privileged?env.SUPABASE_DEV_SECRET_KEY:env.SUPABASE_DEV_PUBLISHABLE_KEY,...(token?{Authorization:`Bearer ${token}`} : {}),...(bytes?{'Content-Type':mime||'application/json','Content-Length':bytes.length}:{})}},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>{const raw=Buffer.concat(chunks).toString();let data;try{data=JSON.parse(raw)}catch{data=null}resolve({status:res.statusCode,data})})});req.setTimeout(30000,()=>req.destroy(Error('Délai réseau')));req.on('error',error=>reject(Error(`Connexion API impossible : ${method} ${path} (${error.code??'timeout'})`)));if(bytes)req.write(bytes);req.end()
})}
function check(name,condition){assert(condition,name);checks.push(name);console.log('OK '+name);persist()}
const rpc=(name,body={},token)=>api('/rest/v1/rpc/'+name,{method:'POST',body,token})
const denied=r=>r.status>=400&&r.status<500
let createdSql=false
persist()
try{
 const baseline=sql("select (select count(*) from portfolio.projects) as projects,(select count(*) from portfolio.releases) as releases,(select count(*) from auth.users) as users,(select active_release_id from portfolio.site_state) as active")[0]
 assert.equal(Number(baseline.projects),0,'Base dev doit être sans données métier pour ce test');assert.equal(Number(baseline.releases),0);assert.equal(Number(baseline.users),0);assert.equal(baseline.active,null)
 const settings=await api('/auth/v1/settings');check('inscriptions publiques désactivées et connexion email disponible',settings.status===200&&settings.data.disable_signup===true&&settings.data.external?.email===true)
 check('publication initiale absente',(await rpc('read_portfolio')).data===null)
 for(const role of ['admin','nonadmin']){
  const email=`test-${role}-${run}@example.invalid`,password=randomBytes(24).toString('hex')
  const u=await api('/auth/v1/admin/users',{method:'POST',privileged:true,body:{email,password,email_confirm:true,user_metadata:{test_run:run}}})
  assert.equal(u.status,200,'Création Auth fictive');assert(u.data.id);users.push({id:u.data.id,role});persist()
  const signed=await api('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});assert.equal(signed.status,200,'Connexion Auth réelle : '+String(signed.data?.error_code??signed.data?.code??'erreur sans code'));assert(signed.data.access_token);users.at(-1).token=signed.data.access_token
 }
 // Persist only IDs/roles, never tokens.
 const admin=users.find(u=>u.role==='admin'),other=users.find(u=>u.role==='nonadmin')
 const tokenA=admin.token,tokenU=other.token;for(const u of users)delete u.token;persist()
 sql(`insert into portfolio.admin_members(user_id) values('${admin.id}');`)
 const key=`uploads/${admin.id}/${ids.image}.webp`,pdfKey=`uploads/${admin.id}/${ids.pdf}.pdf`
 const image=readFileSync('public/images/portraits/kevin-kilongo-chemise-bleue.webp')
 check('upload anonyme refusé',denied(await api('/storage/v1/object/portfolio-private/'+key,{method:'POST',body:image,mime:'image/webp'})))
 check('upload non administrateur refusé',denied(await api('/storage/v1/object/portfolio-private/'+key,{method:'POST',body:image,mime:'image/webp',token:tokenU})))
 const uploaded=await api('/storage/v1/object/portfolio-private/'+key,{method:'POST',body:image,mime:'image/webp',token:tokenA});assert(uploaded.status<300,'Upload admin réel');objects.push(key);persist();check('upload administrateur autorisé',true)
 check('fichier privé non lisible publiquement',denied(await api('/storage/v1/object/public/portfolio-private/'+key)))
 check('signature anonyme du brouillon refusée',denied(await api('/storage/v1/object/sign/portfolio-private/'+key,{method:'POST',body:{expiresIn:60}})))
 check('type SVG refusé',denied(await api('/storage/v1/object/portfolio-private/'+`uploads/${admin.id}/${randomUUID()}.svg`,{method:'POST',body:Buffer.from('<svg/>'),mime:'image/svg+xml',token:tokenA})))
 check('aperçu non admin refusé',denied(await rpc('preview_project',{p_revision:ids.revision},tokenU)))
 check('brouillons non exposés via REST',(await api('/rest/v1/project_revisions')).status>=400)
 const pdf=Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n')
 const p=await api('/storage/v1/object/portfolio-private/'+pdfKey,{method:'POST',body:pdf,mime:'application/pdf',token:tokenA});assert(p.status<300);objects.push(pdfKey);persist()
 const sha=b=>createHash('sha256').update(b).digest('hex')
 const q=s=>"'"+s.replaceAll("'","''")+"'"
 sql(`begin;
 insert into portfolio.projects(id,legacy_id,slug) values('${ids.project}','test-${run}','test-${run}');
 insert into portfolio.project_revisions(id,project_id,title,description,category,mission,internal) values('${ids.revision}','${ids.project}','Publié test','Texte','Habitat','Conception','{"private":"secret-fixture"}'),('${ids.draft}','${ids.project}','Brouillon secret','Texte','Habitat','Conception','{}');
 insert into portfolio.media(id,object_key,kind,mime,bytes,width,height,sha256,validated) values('${ids.image}',${q(key)},'image','image/webp',${image.length},960,1280,'${sha(image)}',true),('${ids.pdf}',${q(pdfKey)},'pdf','application/pdf',${pdf.length},null,null,'${sha(pdf)}',true);
 insert into portfolio.revision_media(revision_id,media_id,position,alt,cover) values('${ids.revision}','${ids.image}',0,'Portrait test',true);
 insert into portfolio.site_revisions(id,name,profession,location,presentation,signature_home,signature_about,email,phone,whatsapp,hero_media_id,portrait_media_id,pdf_media_id) values('${ids.site}','Test','Architecte','Test','Présentation','A','B','fixture@example.invalid','Test','https://wa.me/0','${ids.image}','${ids.image}','${ids.pdf}');
 commit;`);createdSql=true
 const preview=await rpc('preview_project',{p_revision:ids.draft},tokenA);check('aperçu administrateur autorisé',preview.status===200&&preview.data.title==='Brouillon secret')
 const command={p_revisions:[ids.revision],p_site:ids.site,p_featured:[ids.project],p_expected:0}
 check('publication non admin refusée',denied(await rpc('publish_portfolio',command,tokenU)))
 const pub=await rpc('publish_portfolio',command,tokenA);check('publication par API administrateur',pub.status===200&&typeof pub.data==='string')
 const content=await rpc('read_portfolio');check('projection publique sans brouillon ni internal',content.status===200&&content.data.projects[0].title==='Publié test'&&!JSON.stringify(content.data).includes('secret'))
 sql(`update portfolio.project_revisions set title='Nouveau brouillon' where id='${ids.draft}';`)
 check('édition privée sans altération publique',(await rpc('read_portfolio')).data.projects[0].title==='Publié test')
 check('publication concurrente refusée en HTTP 409',(await rpc('publish_portfolio',command,tokenA)).status===409)
 const deletion=await api('/storage/v1/object/portfolio-private',{method:'DELETE',token:tokenA,body:{prefixes:[key]}})
 check('suppression directe admin sans effet sur le fichier utilisé',(denied(deletion)||(deletion.status===200&&Array.isArray(deletion.data)&&deletion.data.length===0))&&(await api('/storage/v1/object/authenticated/portfolio-private/'+key,{token:tokenA})).status===200)
 const serverDeletion=await api('/storage/v1/object/portfolio-private',{method:'DELETE',privileged:true,body:{prefixes:[key]}})
 check('suppression serveur du fichier référencé protégée',serverDeletion.status>=400&&(await api('/storage/v1/object/authenticated/portfolio-private/'+key,{token:tokenA})).status===200)
 sql(`update portfolio.admin_members set active=false where user_id='${admin.id}';`)
 check('administrateur révoqué immédiatement refusé',denied(await rpc('preview_project',{p_revision:ids.draft},tokenA)))
}finally{
 // Exact IDs generated by this run only. No global reset, no trigger bypass.
 if(createdSql)sql(`begin;
 do $$ begin if exists(select 1 from portfolio.site_state st join portfolio.releases r on r.id=st.active_release_id where r.site_revision_id<>'${ids.site}') then raise exception 'Autre publication : nettoyage arrêté'; end if; end $$;
 update portfolio.site_state set active_release_id=null,version=0 where active_release_id in(select id from portfolio.releases where site_revision_id='${ids.site}');
 delete from portfolio.publication_events where release_id in(select id from portfolio.releases where site_revision_id='${ids.site}');
 delete from portfolio.release_projects where project_id='${ids.project}';
 delete from portfolio.releases where site_revision_id='${ids.site}';
 delete from portfolio.revision_media where revision_id in('${ids.revision}','${ids.draft}');
 delete from portfolio.project_revisions where id in('${ids.revision}','${ids.draft}');
 delete from portfolio.site_revisions where id='${ids.site}';
 delete from portfolio.projects where id='${ids.project}';
 delete from portfolio.media where id in('${ids.image}','${ids.pdf}');commit;`)
 if(objects.length){const r=await api('/storage/v1/object/portfolio-private',{method:'DELETE',privileged:true,body:{prefixes:objects}});assert(r.status<300,'Nettoyage fichiers du run')}
 for(const user of users){sql(`delete from portfolio.admin_members where user_id='${user.id}';`);const r=await api('/auth/v1/admin/users/'+user.id,{method:'DELETE',privileged:true});assert(r.status<300,'Nettoyage compte du run')}
 persist({cleaned:true});console.log('Nettoyage ciblé des seules fixtures terminé.')
}
console.log(`${checks.length} contrôles API/Auth/Storage réussis.`)

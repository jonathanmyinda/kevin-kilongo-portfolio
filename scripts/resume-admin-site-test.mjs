// Resume a known disposable run after a lost response; never replay publication.
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
import {randomBytes} from 'node:crypto'
import {Upload,DefaultHttpStack} from 'tus-js-client'
import {verifyTarget,sql,quote} from './dev-tools.mjs'
import {supabaseRequest} from '../server/admin/supabase.mjs'
import {previewOrigin,previewHTTP} from './preview-http.mjs'
verifyTarget()
const path=process.argv[2]
assert(/^node_modules\/.cache\/admin-workflow\/site-[a-f0-9-]+\.local\.json$/.test(path),'Manifeste de fixture requis')
const m=JSON.parse(readFileSync(path));assert(!m.cleaned&&m.checks.length===31,'Cette reprise exige exactement le point de contrôle attendu')
const key=process.env.SUPABASE_DEV_SECRET_KEY,admin=m.users[0],own=m.users.map(quote).join(',')
const accounts=sql(`select id,email from auth.users where id in(${own});`)
assert(accounts.length===2&&accounts.every(x=>new RegExp('^site-(admin|nonadmin)-'+m.run+'@example\\.invalid$').test(x.email)),'Les comptes doivent appartenir à ce run')
const persist=()=>writeFileSync(path,JSON.stringify(m,null,2))
const check=(label,ok)=>{assert(ok,label);m.checks.push(label);persist();console.log('OK '+label)}
let cookie=''
const api=async(action,body,id)=>{const r=await previewHTTP('/api/admin?action='+action+(id?'&id='+id:''),{method:body===undefined?'GET':'POST',headers:{Origin:previewOrigin,Cookie:cookie,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});if(r.cookies.length)cookie=r.cookies.map(c=>c.split(';')[0]).join('; ');return r}
const fingerprint=()=>JSON.stringify(sql("select jsonb_agg(to_jsonb(p)order by p.id) content from portfolio.projects p where legacy_id is not null")[0].content)
const before=fingerprint()
try{
 // Rotate only the random disposable fixture's password, never a human account.
 const password=randomBytes(24).toString('hex')
 assert.equal((await supabaseRequest('/auth/v1/admin/users/'+admin,{method:'PUT',key,body:{password}})).status,200)
 assert.equal((await api('login',{email:accounts.find(x=>x.id===admin).email,password})).status,200)
 const site=(await api('site')).data,first=(await api('site-preview',undefined,m.revisions[1])).data
 const published=(await supabaseRequest('/rest/v1/rpc/read_portfolio',{method:'POST',body:{}})).data
 check('restauration du profil services et ancien PDF',published.profile.pdfMediaId===first.pdfMediaId&&published.profile.subtitle===first.subtitle&&JSON.stringify(published.services)===JSON.stringify(first.services))
 const versions=sql(`select release_id,jsonb_agg(jsonb_build_array(project_id,revision_id)order by project_id) content from portfolio.release_projects where release_id in(${quote(m.releases[2])},(select active_release_id from portfolio.site_state)) group by release_id;`)
 check('restauration ne change pas le projet publié',versions.length===2&&JSON.stringify(versions[0].content)===JSON.stringify(versions[1].content))
 check('restauration conserve le brouillon courant',site.revisionId===m.revisions[2])
 const bytes=Buffer.from('%PDF-1.7\nceci est un faux PDF\n%%EOF\n'),begin=await api('pdf-begin',{name:'faux.pdf',bytes:bytes.length});assert.equal(begin.status,200);const i=begin.data;m.pdfs.push({id:i.id,objectKey:i.objectKey});persist()
 await new Promise((resolve,reject)=>{const up=new Upload(bytes,{endpoint:i.endpoint,httpStack:new DefaultHttpStack({family:4,agent:false}),uploadSize:bytes.length,headers:{apikey:i.publishableKey,'x-signature':i.signature},metadata:{bucketName:i.bucket,objectName:i.objectKey,contentType:'application/pdf'},chunkSize:6*1024**2,uploadDataDuringCreation:true,storeFingerprintForResuming:false,retryDelays:[0,1000,3000],onSuccess:resolve,onError:()=>reject(Error('Transfert fictif interrompu'))});up.start()})
 check('faux PDF réellement refusé après upload',(await api('pdf-finish',{id:i.id})).status===422)
 check('échec PDF ne modifie pas le brouillon',(await api('site')).data.revisionId===m.revisions[2])
}finally{
 // Recover committed release IDs by this run's actor, not by an untrusted head.
 m.releases=sql(`select id from portfolio.releases where created_by in(${own})`).map(x=>x.id);persist()
 const releases=m.releases.map(quote).join(',')||'null',sites=m.revisions.map(quote).join(',')||'null',pdfs=m.pdfs.map(x=>quote(x.id)).join(',')||'null'
 sql(`begin;
 do $$ begin if (select active_release_id from portfolio.site_state) is distinct from ${m.baseline.active_release_id?quote(m.baseline.active_release_id)+'::uuid':'null::uuid'} and not exists(select 1 from portfolio.site_state where active_release_id in(${releases})) then raise exception 'Publication tierce : arrêt';end if;if (select revision_id from portfolio.site_workspace) is distinct from ${quote(m.baseline.workspace)}::uuid and not exists(select 1 from portfolio.site_workspace where revision_id in(${sites})) then raise exception 'Brouillon tiers : arrêt';end if;end $$;
 update portfolio.site_state set active_release_id=${m.baseline.active_release_id?quote(m.baseline.active_release_id):'null'},version=${Number(m.baseline.version)} where active_release_id in(${releases});update portfolio.site_workspace set revision_id=${quote(m.baseline.workspace)} where revision_id in(${sites});
 delete from portfolio.publication_events where release_id in(${releases});delete from portfolio.release_projects where release_id in(${releases});delete from portfolio.releases where id in(${releases});
 delete from portfolio.project_workspaces where project_id in(select id from portfolio.projects where slug=${quote(m.slug)});delete from portfolio.revision_media where revision_id in(select r.id from portfolio.project_revisions r join portfolio.projects p on p.id=r.project_id where p.slug=${quote(m.slug)});delete from portfolio.project_revisions where project_id in(select id from portfolio.projects where slug=${quote(m.slug)});delete from portfolio.projects where slug=${quote(m.slug)};
 delete from portfolio.services where site_revision_id in(${sites});delete from portfolio.social_links where site_revision_id in(${sites});delete from portfolio.site_revisions where id in(${sites});delete from portfolio.pdf_imports where id in(${pdfs});delete from portfolio.media where id in(${pdfs});commit;`)
 for(const [bucket,paths]of[['portfolio-pdf-incoming',m.pdfs.map(x=>x.objectKey)],['portfolio-private',m.pdfs.map(x=>`uploads/${x.id}/${x.id}.pdf`)]])assert((await supabaseRequest('/storage/v1/object/'+bucket,{method:'DELETE',key,body:{prefixes:paths}})).status<300)
 for(const id of m.users){sql(`delete from portfolio.admin_members where user_id=${quote(id)}`);assert((await supabaseRequest('/auth/v1/admin/users/'+id,{method:'DELETE',key})).status<300)}
 assert.equal(fingerprint(),before,'Projets importés inchangés par la reprise')
 m.cleaned=true;persist();console.log(m.checks.length+' contrôles terminés après reprise vérifiée ; fixtures nettoyées et état initial restauré.')
}

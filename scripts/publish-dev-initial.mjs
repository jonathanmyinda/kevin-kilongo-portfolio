import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
import {verifyTarget,sql,quote} from './dev-tools.mjs'
verifyTarget()
const source=JSON.parse(readFileSync('src/data/projects.json')),media=JSON.parse(readFileSync('src/data/published-media.json')),selection=JSON.parse(readFileSync('src/data/homepage-selection.json'))
const projects=sql(`select p.id,p.legacy_id,p.slug,p.archived,r.id revision_id,portfolio.project_public(r.id) data from portfolio.projects p join portfolio.project_revisions r on r.id=portfolio.working_revision(p.id) order by p.legacy_id nulls last`)
const initial=projects.filter(p=>source.some(s=>s.id===p.legacy_id)),excluded=projects.filter(p=>!initial.includes(p))
assert.equal(initial.length,18);assert(initial.every(p=>!p.archived&&p.data.images.length&&p.data.images.filter(i=>i.cover).length===1),'Projet archivé/incomplet : décision humaine requise')
const changes=[]
for(const p of initial){const s=source.find(x=>x.id===p.legacy_id);assert.equal(p.slug,s.slug,'Identité/URL modifiée');assert(!/^test|fixture/i.test(p.data.title),'Titre de test dans un projet importé')
 const expected={title:s.title,description:s.publicDescription||s.description,mission:s.publicRole||s.role,category:s.category,location:s.location??null,agency:s.agency??null,context:s.context?.startsWith('Section II')?null:s.context??null}
 for(const k of Object.keys(expected))if((p.data[k]??null)!==expected[k])changes.push({project:p.legacy_id,field:k,action:'Valeur actuelle conservée'})
}
const state=sql(`select active_release_id,version,portfolio.working_site() site_id from portfolio.site_state`)[0]
const site=sql(`select portfolio.site_public(${quote(state.site_id)}) data`)[0].data
const ids=initial.map(p=>quote(p.revision_id)).join(','),files=sql(`select g.revision_id,g.position,m.legacy_path,m.validated from portfolio.revision_media g join portfolio.media m on m.id=g.media_id where g.revision_id in(${ids}) order by g.revision_id,g.position`)
for(const p of initial){const expected=media.projects[p.legacy_id].images.map(i=>i.src),current=files.filter(f=>f.revision_id===p.revision_id);assert(current.every(f=>f.validated),'Fichier non validé');if(JSON.stringify(expected)!==JSON.stringify(current.map(f=>f.legacy_path)))changes.push({project:p.legacy_id,field:'images',action:'Galerie actuelle conservée'})}
const report={target:'pahbwurduwagdglpslos',region:'eu-west-1',state,selected:initial.map(p=>({id:p.id,legacyId:p.legacy_id,slug:p.slug,revisionId:p.revision_id,title:p.data.title})),excluded:excluded.map(p=>({id:p.id,slug:p.slug,action:'Conservé en privé, jamais inclus'})),changes,site:{revisionId:state.site_id,name:site.name,heroMediaId:site.heroMediaId,portraitMediaId:site.portraitMediaId,pdfMediaId:site.pdfMediaId,pdf:site.pdf,services:site.services.length},applied:false}
const path='node_modules/.cache/admin-workflow/initial-publication.local.json';writeFileSync(path,JSON.stringify(report,null,2))
console.log(JSON.stringify({selected:initial.length,excluded:excluded.length,currentEditsPreserved:changes,site:report.site},null,2))
if(!process.argv.includes('--apply')){console.log('Audit seulement. Aucun brouillon modifié.');process.exit(0)}
if(state.active_release_id){console.log('Publication déjà présente : aucune republication implicite de brouillons.');process.exit(0)}
const actor=process.argv[process.argv.indexOf('--actor')+1];assert(/^[a-f0-9-]{36}$/i.test(actor),'UID autorisé requis, aucun compte créé')
assert.equal(Number(sql(`select count(*) n from portfolio.admin_members a join auth.users u on u.id=a.user_id where a.user_id=${quote(actor)} and a.active`)[0].n),1)
const featured=selection.map(x=>initial.find(p=>p.legacy_id===x.projectId)?.id);assert(featured.every(Boolean))
const result=sql(`begin;
select set_config('request.jwt.claim.sub',${quote(actor)},true),set_config('request.jwt.claims',${quote(JSON.stringify({sub:actor,role:'authenticated'}))},true);
do $$ begin if portfolio.working_site()<>${quote(state.site_id)}::uuid or (select active_release_id from portfolio.site_state) is not null then raise exception 'État modifié depuis audit';end if;
${initial.map(p=>`if portfolio.working_revision(${quote(p.id)})<>${quote(p.revision_id)}::uuid then raise exception 'Brouillon modifié depuis audit';end if;`).join('\n')}end $$;
select public.publish_portfolio(array[${ids}]::uuid[],${quote(state.site_id)},array[${featured.map(quote).join(',')}]::uuid[],${Number(state.version)}) release_id;commit;`)
report.applied=true;report.releaseId=result.find(x=>x.release_id)?.release_id;writeFileSync(path,JSON.stringify(report,null,2));console.log('Publication initiale atomique créée dans DEV ; brouillons, fixture existante et compte personnel préservés.')

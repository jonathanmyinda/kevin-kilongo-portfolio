// Recovery only for an explicitly identified disposable image test manifest.
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
import {verifyTarget,sql,quote} from './dev-tools.mjs'
import {supabaseRequest} from '../server/admin/supabase.mjs'
verifyTarget()
const path=process.argv[2];assert(/^node_modules\/.cache\/admin-workflow\/images-[a-f0-9-]+\.local\.json$/.test(path))
const m=JSON.parse(readFileSync(path));assert(!m.cleaned&&m.baseline,'Manifeste actif avec état initial requis')
const users=m.users.map(quote).join(',')||'null',ids=m.intents.map(quote).join(',')||'null'
const people=sql(`select id,email from auth.users where id in(${users})`)
assert(people.every(p=>new RegExp('^images-(admin|nonadmin)-'+m.run+'@example\\.invalid$').test(p.email)),'Compte étranger au run')
const files=sql(`select id,incoming_key,final_key from portfolio.image_imports where id in(${ids})`)
const releases=sql(`select id from portfolio.releases where created_by in(${users})`).map(x=>quote(x.id)).join(',')||'null'
sql(`begin;
do $$ begin if (select active_release_id from portfolio.site_state) is distinct from ${m.baseline.active_release_id?quote(m.baseline.active_release_id)+'::uuid':'null::uuid'} and not exists(select 1 from portfolio.site_state where active_release_id in(${releases})) then raise exception 'Publication tierce : arrêt';end if;end $$;
update portfolio.site_state set active_release_id=${m.baseline.active_release_id?quote(m.baseline.active_release_id):'null'},version=${Number(m.baseline.version)} where active_release_id in(${releases});
delete from portfolio.publication_events where release_id in(${releases});delete from portfolio.release_projects where release_id in(${releases});delete from portfolio.releases where id in(${releases});
delete from portfolio.project_workspaces where project_id in(select id from portfolio.projects where slug=${quote(m.slug)});delete from portfolio.revision_media where revision_id in(select r.id from portfolio.project_revisions r join portfolio.projects p on p.id=r.project_id where p.slug=${quote(m.slug)});delete from portfolio.project_revisions where project_id in(select id from portfolio.projects where slug=${quote(m.slug)});delete from portfolio.projects where slug=${quote(m.slug)};
delete from portfolio.image_imports where id in(${ids});delete from portfolio.media where id in(${ids});commit;`)
const key=process.env.SUPABASE_DEV_SECRET_KEY
for(const [bucket,keys]of[['portfolio-incoming',files.map(x=>x.incoming_key)],['portfolio-private',files.map(x=>x.final_key)]])if(keys.length)assert((await supabaseRequest('/storage/v1/object/'+bucket,{method:'DELETE',key,body:{prefixes:keys}})).status<300)
for(const u of people){sql(`delete from portfolio.admin_members where user_id=${quote(u.id)}`);assert((await supabaseRequest('/auth/v1/admin/users/'+u.id,{method:'DELETE',key})).status<300)}
m.cleaned=true;writeFileSync(path,JSON.stringify(m,null,2));console.log('Fixtures du run identifiées et nettoyées ; aucune réinitialisation.')

// Dedicated manual editor fixture. Never publishes or modifies imported projects.
import { randomUUID } from 'node:crypto'
import { verifyTarget, sql, quote } from './dev-tools.mjs'
verifyTarget()
const slug = 'test-editeur-administration'
const marker = 'manual-editor-fixture-v1'
const existing = sql(`select p.id,r.id as revision_id,r.internal->>'testFixture' as marker from portfolio.projects p join portfolio.project_revisions r on r.id=portfolio.working_revision(p.id) where p.slug=${quote(slug)};`)
if (existing.length) {
  if (existing.length !== 1 || existing[0].marker !== marker) throw new Error('Slug occupé : aucun écrasement')
  console.log('Projet de test déjà préparé : ' + slug)
  process.exit(0)
}
const id = randomUUID(), revision = randomUUID()
const snapshot = `jsonb_build_object(
 'projects',(select jsonb_agg(to_jsonb(p) order by p.id) from portfolio.projects p where legacy_id is not null),
 'revisions',(select jsonb_agg(to_jsonb(r) order by r.id) from portfolio.project_revisions r join portfolio.projects p on p.id=r.project_id where p.legacy_id is not null),
 'gallery',(select jsonb_agg(to_jsonb(g) order by g.revision_id,g.position) from portfolio.revision_media g join portfolio.project_revisions r on r.id=g.revision_id join portfolio.projects p on p.id=r.project_id where p.legacy_id is not null),
 'workspaces',(select jsonb_agg(to_jsonb(w) order by w.project_id) from portfolio.project_workspaces w join portfolio.projects p on p.id=w.project_id where p.legacy_id is not null),
 'publication',(select to_jsonb(s) from portfolio.site_state s))`
const result = sql(`begin;
create temporary table fixture_before on commit drop as select ${snapshot} as content;
do $$ begin if (select count(*) from portfolio.projects where legacy_id is not null)<>18 then raise exception '18 projets importés attendus'; end if; end $$;
insert into portfolio.projects(id,slug) values(${quote(id)},${quote(slug)});
insert into portfolio.project_revisions(id,project_id,title,description,category,location,mission,agency,context,internal)
values(${quote(revision)},${quote(id)},'TEST — Vérification de l’éditeur','Projet fictif réservé aux essais de l’administration. Ce contenu ne représente pas une nouvelle réalisation.','Test',null,'Saisie fictive pour vérifier l’enregistrement et l’aperçu.',null,
'Médias existants repris pour cet essai uniquement ; leurs crédits sont conservés.',jsonb_build_object('testFixture',${quote(marker)}));
insert into portfolio.revision_media(revision_id,media_id,position,alt,caption,credit,cover)
select ${quote(revision)},g.media_id,g.position,g.alt,g.caption,g.credit,g.cover from portfolio.revision_media g
where g.revision_id=(select r.id from portfolio.project_revisions r join portfolio.projects p on p.id=r.project_id where p.legacy_id='project-01' order by r.created_at,r.id limit 1);
do $$ begin if not exists(select 1 from portfolio.revision_media where revision_id=${quote(revision)} and cover) then raise exception 'Couverture de test manquante'; end if; end $$;
insert into portfolio.project_workspaces values(${quote(id)},${quote(revision)});
do $$ begin if (select content from fixture_before) is distinct from (select ${snapshot}) then raise exception 'Contenus importés ou publication modifiés : annulation'; end if; end $$;
commit;
select p.id,p.slug,r.title,not exists(select 1 from portfolio.release_projects where project_id=p.id) as draft_only from portfolio.projects p join portfolio.project_revisions r on r.id=portfolio.working_revision(p.id) where p.id=${quote(id)};`)
console.log(JSON.stringify({fixture:result[0],importedProjectsUnchanged:true,publicationUnchanged:true,uploadsCreated:0}))

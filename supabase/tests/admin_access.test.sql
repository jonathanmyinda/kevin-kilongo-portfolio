-- Local disposable fixtures ONLY, all rolled back. No actual account invitation.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
-- Isolate the initial publication inside this rolled-back transaction only.
update portfolio.site_state set active_release_id=null,version=0;
select plan(19);
insert into auth.users(id,email) values
 ('10000000-0000-0000-0000-000000000001','admin-fixture@example.invalid'),
 ('10000000-0000-0000-0000-000000000002','user-fixture@example.invalid');
insert into portfolio.admin_members(user_id) values('10000000-0000-0000-0000-000000000001');
insert into portfolio.projects(id,legacy_id,slug) values('20000000-0000-0000-0000-000000000001','fixture','fixture');
insert into portfolio.project_revisions(id,project_id,title,description,category,mission) values
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Publié','Texte','Habitat','Conception'),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','Brouillon secret','Texte','Habitat','Conception');
insert into portfolio.media(id,object_key,kind,mime,bytes,width,height,sha256,validated) values
 ('40000000-0000-0000-0000-000000000001','fixture/image.webp','image','image/webp',100,10,10,repeat('a',64),true),
 ('40000000-0000-0000-0000-000000000002','fixture/document.pdf','pdf','application/pdf',100,null,null,repeat('b',64),true);
insert into storage.objects(bucket_id,name) values('portfolio-private','fixture/image.webp'),('portfolio-private','fixture/document.pdf');
insert into portfolio.revision_media(revision_id,media_id,position,alt,cover) values
 ('30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',0,'Vue',true);
insert into portfolio.site_revisions(id,name,profession,location,presentation,signature_home,signature_about,email,phone,whatsapp,hero_media_id,portrait_media_id,pdf_media_id)
values('50000000-0000-0000-0000-000000000001','Test','Architecte','Test','Présentation','A','B','fixture@example.invalid','Test','https://wa.me/0','40000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002');
set local role anon;
select is(public.read_portfolio(),null::jsonb,'Aucune publication initiale');
select throws_like($$select * from portfolio.project_revisions$$,'%permission denied%','Anon ne lit pas les brouillons');
select throws_like($$select public.preview_project('30000000-0000-0000-0000-000000000002')$$,'%permission denied%','Aperçu interdit anon');
reset role;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
set local role authenticated;
select is((select count(*) from portfolio.project_revisions),0::bigint,'Connecté non admin sans données');
select throws_like($$insert into portfolio.admin_members(user_id) values(auth.uid())$$,'%permission denied%','Auto attribution interdite');
select throws_like($$select public.publish_portfolio('{}','50000000-0000-0000-0000-000000000001','{}',0)$$,'%Administration requise%','Publication interdite non admin');
select throws_like($$insert into portfolio.projects(slug) values('intrusion')$$,'%row-level security%','Écriture interdite non admin');
select throws_like($$insert into storage.objects(bucket_id,name) values('portfolio-private','uploads/60000000-0000-0000-0000-000000000001/60000000-0000-0000-0000-000000000001.webp')$$,'%row-level security%','Upload interdit non admin');
reset role;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select is((select count(*) from portfolio.project_revisions where project_id='20000000-0000-0000-0000-000000000001'),2::bigint,'Admin lit les révisions de la fixture');
select throws_like($$insert into storage.objects(bucket_id,name) values('portfolio-private','uploads/60000000-0000-0000-0000-000000000001/60000000-0000-0000-0000-000000000001.webp')$$,'%row-level security%','Bucket final écrit seulement par le serveur après validation');
select throws_like($$insert into storage.objects(bucket_id,name) values('portfolio-private','uploads/60000000-0000-0000-0000-000000000001/60000000-0000-0000-0000-000000000001.svg')$$,'%row-level security%','Écriture directe SVG refusée');
select lives_ok($$select public.publish_portfolio(array['30000000-0000-0000-0000-000000000001'::uuid],'50000000-0000-0000-0000-000000000001',array['20000000-0000-0000-0000-000000000001'::uuid],0)$$,'Publication admin');
select lives_ok($$update portfolio.project_revisions set title='Autre brouillon' where id='30000000-0000-0000-0000-000000000002'$$,'Édition du brouillon');
select throws_like($$update portfolio.project_revisions set title='Mutation' where id='30000000-0000-0000-0000-000000000001'$$,'%Publication immuable%','Révision publiée figée');
select throws_like($$select public.publish_portfolio('{}','50000000-0000-0000-0000-000000000001','{}',0)$$,'%Publication concurrente%','Version obsolète refusée');
reset role;
set local role anon;
select is(public.read_portfolio()->'projects'->0->>'title','Publié','Édition sans effet public');
select ok(not(public.read_portfolio()::text like '%Autre brouillon%'),'Pas de brouillon dans la projection');
select is((select count(*) from storage.objects where bucket_id='portfolio-private'),0::bigint,'Bucket privé illisible anon');
reset role;
select throws_like($$delete from portfolio.media where id='40000000-0000-0000-0000-000000000001'$$,'%foreign key%','Suppression du registre média référencé protégée');
select * from finish();
rollback;

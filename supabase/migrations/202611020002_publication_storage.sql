begin;
create function public.publish_portfolio(p_revisions uuid[], p_site uuid, p_featured uuid[], p_expected bigint)
returns uuid language plpgsql security definer set search_path='' as $$
declare v bigint; result uuid; m record; s portfolio.site_revisions;
begin
 if not portfolio.is_admin() then raise exception 'Administration requise' using errcode='42501'; end if;
 select version into v from portfolio.site_state where singleton for update;
 perform 1 from portfolio.project_revisions where id=any(p_revisions) order by id for update;
 perform 1 from portfolio.site_revisions where id=p_site for update;
 if v<>p_expected then raise exception 'Publication concurrente' using errcode='40001'; end if;
 if p_revisions is null or p_featured is null then raise exception 'Listes obligatoires'; end if;
 if cardinality(p_revisions)<>(select count(distinct id) from portfolio.project_revisions where id=any(p_revisions)) then raise exception 'Révision absente ou répétée'; end if;
 if exists(select project_id from portfolio.project_revisions where id=any(p_revisions) group by project_id having count(*)>1) then raise exception 'Deux versions du même projet'; end if;
 if cardinality(p_featured)<>(select count(distinct x) from unnest(p_featured) x) then raise exception 'Sélection répétée'; end if;
 if exists(select 1 from unnest(p_featured) x where not exists(select 1 from portfolio.project_revisions r where r.id=any(p_revisions) and r.project_id=x)) then raise exception 'Sélection non publiée'; end if;
 select * into strict s from portfolio.site_revisions where id=p_site;
 if exists(select 1 from portfolio.project_revisions r where r.id=any(p_revisions) and
   ((select count(*) from portfolio.revision_media g where g.revision_id=r.id and g.cover)<>1
    or exists(select 1 from portfolio.projects p where p.id=r.project_id and p.archived))) then raise exception 'Couverture manquante ou projet archivé'; end if;
 for m in
  select media_id id from portfolio.revision_media where revision_id=any(p_revisions)
  union select s.hero_media_id union select s.portrait_media_id union select s.pdf_media_id
  union select media_id from portfolio.services where site_revision_id=p_site and media_id is not null
 loop
  if not exists(select 1 from portfolio.media a join storage.objects o on o.bucket_id='portfolio-private' and o.name=a.object_key where a.id=m.id and a.validated) then raise exception 'Fichier absent ou non validé'; end if;
 end loop;
 if not exists(select 1 from portfolio.media where id=s.pdf_media_id and kind='pdf')
 or exists(select 1 from portfolio.media where id=any(array[s.hero_media_id,s.portrait_media_id]) and kind<>'image')
 or exists(select 1 from portfolio.revision_media g join portfolio.media a on a.id=g.media_id where g.revision_id=any(p_revisions) and a.kind<>'image') then raise exception 'Type de média incorrect'; end if;
 insert into portfolio.releases(site_revision_id,created_by) values(p_site,auth.uid()) returning id into result;
 insert into portfolio.release_projects(release_id,project_id,revision_id,featured_position)
 select result,r.project_id,r.id,array_position(p_featured,r.project_id)-1 from portfolio.project_revisions r where r.id=any(p_revisions);
 update portfolio.site_state set active_release_id=result,version=version+1 where singleton;
 insert into portfolio.publication_events(actor,release_id,action) values(auth.uid(),result,'publish');
 return result;
end $$;
create function public.restore_portfolio(p_release uuid,p_expected bigint) returns void
language plpgsql security definer set search_path='' as $$
declare v bigint;
begin
 if not portfolio.is_admin() then raise exception 'Administration requise' using errcode='42501'; end if;
 select version into v from portfolio.site_state where singleton for update;
 if v<>p_expected then raise exception 'Publication concurrente' using errcode='40001'; end if;
 if not exists(select 1 from portfolio.releases where id=p_release) then raise exception 'Publication inconnue'; end if;
 update portfolio.site_state set active_release_id=p_release,version=version+1 where singleton;
 insert into portfolio.publication_events(actor,release_id,action) values(auth.uid(),p_release,'restore');
end $$;
create function portfolio.project_public(p_revision uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',coalesce(p.legacy_id,p.id::text),'slug',p.slug,'title',r.title,'description',r.description,
 'category',r.category,'location',r.location,'mission',r.mission,'agency',r.agency,'context',r.context,
 'images',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'kind',m.kind,'width',m.width,'height',m.height,
 'alt',g.alt,'caption',g.caption,'credit',g.credit,'cover',g.cover,'position',g.position) order by g.position)
 from portfolio.revision_media g join portfolio.media m on m.id=g.media_id where g.revision_id=r.id),'[]'::jsonb))
 from portfolio.project_revisions r join portfolio.projects p on p.id=r.project_id where r.id=p_revision
$$;
create function public.read_portfolio() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('schemaVersion',1,'releaseId',rel.id,'version',st.version,
 'projects',coalesce((select jsonb_agg(portfolio.project_public(rp.revision_id) order by p.legacy_id)
 from portfolio.release_projects rp join portfolio.projects p on p.id=rp.project_id where rp.release_id=rel.id),'[]'::jsonb),
 'featured',coalesce((select jsonb_agg(p.legacy_id order by rp.featured_position) from portfolio.release_projects rp
 join portfolio.projects p on p.id=rp.project_id where rp.release_id=rel.id and rp.featured_position is not null),'[]'::jsonb),
 'profile',jsonb_build_object('name',s.name,'profession',s.profession,'location',s.location,'presentation',s.presentation,
 'signatureHome',s.signature_home,'signatureAbout',s.signature_about,'email',s.email,'phone',s.phone,'whatsapp',s.whatsapp,
 'heroMediaId',s.hero_media_id,'portraitMediaId',s.portrait_media_id,'pdfMediaId',s.pdf_media_id,
 'socials',coalesce((select jsonb_agg(jsonb_build_object('label',l.label,'url',l.url) order by l.position) from portfolio.social_links l where l.site_revision_id=s.id),'[]'::jsonb)),
 'services',coalesce((select jsonb_agg(jsonb_build_object('title',v.title,'description',v.description,'mediaId',v.media_id,'alt',v.alt,'credit',v.credit) order by v.position) from portfolio.services v where v.site_revision_id=s.id),'[]'::jsonb))
 from portfolio.site_state st join portfolio.releases rel on rel.id=st.active_release_id
 join portfolio.site_revisions s on s.id=rel.site_revision_id where st.singleton
$$;
create function public.preview_project(p_revision uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not portfolio.is_admin() then raise exception 'Administration requise' using errcode='42501'; end if;
 return portfolio.project_public(p_revision);
end $$;
-- Callable only by the future API's server key. It can resolve current media ONLY.
create function public.published_media_key(p_media uuid) returns text language sql stable security definer set search_path='' as $$
 select a.object_key from portfolio.media a where a.id=p_media and a.validated and exists(
 select 1 from portfolio.site_state st join portfolio.releases r on r.id=st.active_release_id
 join portfolio.site_revisions s on s.id=r.site_revision_id where st.singleton and
 (a.id=any(array[s.hero_media_id,s.portrait_media_id,s.pdf_media_id])
 or exists(select 1 from portfolio.services v where v.site_revision_id=s.id and v.media_id=a.id)
 or exists(select 1 from portfolio.release_projects rp join portfolio.revision_media g on g.revision_id=rp.revision_id where rp.release_id=r.id and g.media_id=a.id)))
$$;
revoke all on function portfolio.project_public(uuid) from public,anon,authenticated;
revoke all on function public.read_portfolio() from public;
grant execute on function public.read_portfolio() to anon,authenticated,service_role;
revoke all on function public.publish_portfolio(uuid[],uuid,uuid[],bigint), public.restore_portfolio(uuid,bigint), public.preview_project(uuid) from public,anon;
grant execute on function public.publish_portfolio(uuid[],uuid,uuid[],bigint), public.restore_portfolio(uuid,bigint), public.preview_project(uuid) to authenticated;
revoke all on function public.published_media_key(uuid) from public,anon,authenticated;
grant execute on function public.published_media_key(uuid) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('portfolio-private','portfolio-private',false,20971520,array['image/jpeg','image/png','image/webp','application/pdf']);
create policy portfolio_admin_upload on storage.objects for insert to authenticated
with check(bucket_id='portfolio-private' and portfolio.is_admin() and name ~ '^uploads/[a-f0-9-]+/[a-f0-9-]+\.(jpg|png|webp|pdf)$');
create policy portfolio_admin_read on storage.objects for select to authenticated
using(bucket_id='portfolio-private' and portfolio.is_admin());
-- Intentionally NO anon read, UPDATE or DELETE policy. No client upsert.
-- FK dependencies protect media rows; binary deletion is a server-only workflow.
commit;

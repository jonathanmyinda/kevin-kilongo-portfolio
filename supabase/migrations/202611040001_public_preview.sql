begin;
-- Explicit public projection only. The source archive is never returned.
alter function portfolio.project_public(uuid) rename to project_public_core;
create function portfolio.project_public(p_revision uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select portfolio.project_public_core(p_revision)||jsonb_build_object('revisionId',r.id,'number',r.internal->'number','year',r.internal->'year','phase',r.internal->'phase',
 'missionLabel',case when r.mission=r.internal->>'publicRole' then coalesce(r.internal->>'missionLabel',r.mission) else r.mission end,
 'tools',coalesce((select jsonb_agg(jsonb_build_object('name',x->>'name','usage',x->>'usage')) from jsonb_array_elements(coalesce(r.internal->'tools','[]'))x),'[]'),
 'typologies',coalesce((select jsonb_agg(jsonb_build_object('name',x->>'name','areaSqm',x->'areaSqm')) from jsonb_array_elements(coalesce(r.internal->'typologies','[]'))x),'[]'))
 from portfolio.project_revisions r where r.id=p_revision
$$;
revoke all on function portfolio.project_public(uuid),portfolio.project_public_core(uuid) from public,anon,authenticated;
create function portfolio.profile_public_facts(p_site uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'education',coalesce((select jsonb_agg(jsonb_build_object('qualification',x->>'qualification','institution',x->>'institution','year',x->'year')) from jsonb_array_elements(coalesce(s.internal->'profile'->'education','[]'))x),'[]'),
 'experiences',coalesce((select jsonb_agg(jsonb_build_object('organization',x->>'organization','title',x->>'title','description',x->>'description','start',x->>'start','end',x->>'end')) from jsonb_array_elements(coalesce(s.internal->'profile'->'experiences','[]'))x),'[]'),
 'internships',coalesce((select jsonb_agg(jsonb_build_object('organization',x->>'organization','start',x->>'start','end',x->>'end')) from jsonb_array_elements(coalesce(s.internal->'profile'->'internships','[]'))x),'[]'),
 'software',coalesce((select jsonb_agg(jsonb_build_object('category',x->>'category','tools',x->'tools')) from jsonb_array_elements(coalesce(s.internal->'profile'->'software','[]'))x),'[]'),
 'languages',coalesce(s.internal->'profile'->'languages','[]')) from portfolio.site_revisions s where s.id=p_site
$$;
revoke all on function portfolio.profile_public_facts(uuid) from public,anon,authenticated;
create or replace function public.read_portfolio() returns jsonb language sql stable security definer set search_path='' as $$
 select case when b.base is null then null else b.base||jsonb_build_object(
 'profile',(portfolio.site_public(r.site_revision_id)-'services')||portfolio.profile_public_facts(r.site_revision_id),
 'services',portfolio.site_public(r.site_revision_id)->'services',
 'featured',coalesce((select jsonb_agg(coalesce(p.legacy_id,p.id::text) order by rp.featured_position) from portfolio.release_projects rp join portfolio.projects p on p.id=rp.project_id where rp.release_id=r.id and rp.featured_position is not null),'[]')) end
 from(select portfolio.read_portfolio_legacy() base)b left join portfolio.site_state st on st.singleton left join portfolio.releases r on r.id=st.active_release_id
$$;
-- Function calls made by the legacy reader must resolve the enriched projection.
-- SQL bodies are stored as text and re-resolve the same qualified function name.
alter function public.published_media_key(uuid) set schema portfolio;
alter function portfolio.published_media_key(uuid) rename to published_media_base_key;
create function public.published_media_key(p_media uuid) returns text language sql stable security definer set search_path='' as $$
 select m.object_key from portfolio.media m where m.id=p_media and m.validated and
 (portfolio.published_media_base_key(m.id) is not null or exists(select 1 from portfolio.media_derivatives d where d.media_id=m.id and portfolio.published_media_base_key(d.parent_id) is not null))
$$;
create function public.published_files() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'key',m.object_key,'kind',m.kind,'mime',m.mime,'bytes',m.bytes,'width',m.width,'height',m.height,'legacyPath',m.legacy_path,
 'parents',coalesce((select jsonb_agg(d.parent_id) from portfolio.media_derivatives d where d.media_id=m.id),'[]'))),'[]') from portfolio.media m where public.published_media_key(m.id) is not null
$$;
revoke all on function public.published_media_key(uuid),public.published_files(),portfolio.published_media_base_key(uuid) from public,anon,authenticated;
grant execute on function public.published_media_key(uuid),public.published_files() to service_role;

create function public.admin_project_history(p_project uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not portfolio.is_admin() then raise exception 'Administration requise' using errcode='42501';end if;
 return coalesce((select jsonb_agg(x order by x->>'publishedAt' desc) from(select jsonb_build_object('revisionId',r.id,'title',r.title,'publishedAt',max(rel.created_at),'active',bool_or(rp.release_id=(select active_release_id from portfolio.site_state))) x from portfolio.project_revisions r join portfolio.release_projects rp on rp.revision_id=r.id join portfolio.releases rel on rel.id=rp.release_id where r.project_id=p_project group by r.id,r.title)q),'[]');
end $$;
create function public.admin_project_publication(p_project uuid,p_revision uuid,p_expected bigint) returns uuid language plpgsql security definer set search_path='' as $$
declare revisions uuid[]; featured uuid[]; sid uuid; result uuid;
begin
 if not portfolio.is_admin() then raise exception 'Administration requise' using errcode='42501';end if;
 perform 1 from portfolio.site_state where singleton for update;
 if (select version from portfolio.site_state)<>p_expected then raise exception 'Publication concurrente' using errcode='PT409';end if;
 perform 1 from portfolio.projects where id=p_project for update;
 if not found then raise exception 'Projet inconnu' using errcode='P0002';end if;
 if p_revision is not null and not exists(select 1 from portfolio.project_revisions r join portfolio.release_projects rp on rp.revision_id=r.id where r.id=p_revision and r.project_id=p_project) then raise exception 'Version jamais publiée' using errcode='22023';end if;
 select r.site_revision_id into sid from portfolio.releases r where r.id=(select active_release_id from portfolio.site_state);
 if sid is null then raise exception 'Aucune publication' using errcode='22023';end if;
 select coalesce(array_agg(rp.revision_id)filter(where rp.project_id<>p_project),'{}'::uuid[]),coalesce(array_agg(rp.project_id order by rp.featured_position)filter(where rp.featured_position is not null and (rp.project_id<>p_project or p_revision is not null)),'{}'::uuid[]) into revisions,featured from portfolio.release_projects rp where rp.release_id=(select active_release_id from portfolio.site_state);
 if p_revision is not null then revisions:=array_append(revisions,p_revision);end if;
 result:=public.publish_portfolio(revisions,sid,featured,p_expected);
 return result;
end $$;
revoke all on function public.admin_project_history(uuid),public.admin_project_publication(uuid,uuid,bigint) from public,anon;
grant execute on function public.admin_project_history(uuid),public.admin_project_publication(uuid,uuid,bigint) to authenticated;
commit;

begin;
-- Append-only editing, with optimistic concurrency independent from publication.
create table portfolio.project_workspaces (
 project_id uuid primary key references portfolio.projects(id),
 revision_id uuid not null references portfolio.project_revisions(id)
);
alter table portfolio.project_workspaces enable row level security;
create policy admin_read on portfolio.project_workspaces for select to authenticated using(portfolio.is_admin());
grant select on portfolio.project_workspaces to authenticated;

create function public.admin_session() returns boolean language sql stable security definer set search_path='' as $$
 select portfolio.is_admin()
$$;
create function portfolio.working_revision(p_project uuid) returns uuid language sql stable set search_path='' as $$
 select coalesce((select revision_id from portfolio.project_workspaces where project_id=p_project),
 (select id from portfolio.project_revisions where project_id=p_project order by created_at desc,id desc limit 1))
$$;
create function public.admin_projects() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not portfolio.is_admin() then raise exception 'Administration requise' using errcode='42501'; end if;
 return jsonb_build_object('version',(select version from portfolio.site_state),
 'siteId',coalesce((select r.site_revision_id from portfolio.site_state s join portfolio.releases r on r.id=s.active_release_id),(select id from portfolio.site_revisions order by id limit 1)),
 'projects',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'slug',p.slug,'legacyId',p.legacy_id,
 'revisionId',r.id,'publishedRevisionId',rp.revision_id,
 'status',case when rp.revision_id is null then 'draft' when rp.revision_id=r.id then 'published' else 'changed' end,
 'data',portfolio.project_public(r.id)) order by p.slug)
 from portfolio.projects p join portfolio.project_revisions r on r.id=portfolio.working_revision(p.id)
 left join portfolio.release_projects rp on rp.project_id=p.id and rp.release_id=(select active_release_id from portfolio.site_state)
 where not p.archived),'[]'::jsonb));
end $$;

create function public.admin_save_project(p_project uuid,p_expected uuid,p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare rid uuid:=gen_random_uuid(); pid uuid:=p_project; previous uuid; img jsonb; n integer:=0;
begin
 if not portfolio.is_admin() then raise exception 'Administration requise' using errcode='42501'; end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Projet invalide' using errcode='22023'; end if;
 if exists(select 1 from jsonb_object_keys(p_data) k where k<>all(array['title','description','category','location','mission','agency','context','slug','images'])) then raise exception 'Champ interdit' using errcode='22023'; end if;
 if length(trim(coalesce(p_data->>'title',''))) not between 1 and 180
 or length(trim(coalesce(p_data->>'description',''))) not between 1 and 10000
 or length(trim(coalesce(p_data->>'category',''))) not between 1 and 180
 or length(trim(coalesce(p_data->>'mission',''))) not between 1 and 5000
 or length(coalesce(p_data->>'location',''))>1000 or length(coalesce(p_data->>'agency',''))>1000
 or length(coalesce(p_data->>'context',''))>1000
 or coalesce(p_data->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
 or jsonb_typeof(p_data->'images') is distinct from 'array'
 then raise exception 'Champs invalides' using errcode='22023'; end if;
 if jsonb_array_length(p_data->'images') not between 1 and 100
 or (select count(*) from jsonb_array_elements(p_data->'images') x where x->>'cover'='true')<>1 then raise exception 'Une couverture obligatoire' using errcode='22023'; end if;
 if pid is null then
 if p_expected is not null then raise exception 'Conflit' using errcode='PT409'; end if;
 insert into portfolio.projects(slug) values(p_data->>'slug') returning id into pid;
 else
 perform 1 from portfolio.projects where id=pid and not archived for update;
 if not found then raise exception 'Projet inconnu' using errcode='P0002'; end if;
 previous:=portfolio.working_revision(pid);
 if previous is distinct from p_expected then raise exception 'Brouillon modifié ailleurs' using errcode='PT409'; end if;
 if (select slug from portfolio.projects where id=pid)<>p_data->>'slug' then raise exception 'Slug existant immuable' using errcode='22023'; end if;
 end if;
 insert into portfolio.project_revisions(id,project_id,title,description,category,location,mission,agency,context,internal)
 values(rid,pid,p_data->>'title',p_data->>'description',p_data->>'category',p_data->>'location',p_data->>'mission',p_data->>'agency',p_data->>'context',coalesce((select internal from portfolio.project_revisions where id=previous),'{}'::jsonb));
 for img in select value from jsonb_array_elements(p_data->'images') loop
 if (img->>'position')::integer<>n or length(trim(coalesce(img->>'alt',''))) not between 1 and 1000
 or length(coalesce(img->>'caption',''))>2000 or length(coalesce(img->>'credit',''))>2000
 or not exists(select 1 from portfolio.media where id=(img->>'id')::uuid and kind='image' and validated)
 then raise exception 'Média invalide' using errcode='22023'; end if;
 insert into portfolio.revision_media(revision_id,media_id,position,alt,caption,credit,cover)
 values(rid,(img->>'id')::uuid,n,img->>'alt',img->>'caption',img->>'credit',(img->>'cover')::boolean);
 n:=n+1;
 end loop;
 insert into portfolio.project_workspaces values(pid,rid) on conflict(project_id) do update set revision_id=excluded.revision_id;
 return rid;
end $$;

create function public.admin_publish_project(p_project uuid,p_revision uuid,p_site uuid,p_expected bigint) returns uuid
language plpgsql security definer set search_path='' as $$
declare revisions uuid[]; featured uuid[]; sid uuid;
begin
 if not portfolio.is_admin() then raise exception 'Administration requise' using errcode='42501'; end if;
 -- Same lock order as publish_portfolio; save never takes the site-state lock.
 perform 1 from portfolio.site_state where singleton for update;
 perform 1 from portfolio.projects where id=p_project for update;
 if portfolio.working_revision(p_project) is distinct from p_revision then raise exception 'Brouillon modifié ailleurs' using errcode='PT409'; end if;
 select coalesce(array_agg(rp.revision_id) filter(where rp.project_id<>p_project),'{}'::uuid[]) into revisions
 from portfolio.release_projects rp where rp.release_id=(select active_release_id from portfolio.site_state);
 select coalesce(array_agg(rp.project_id order by rp.featured_position) filter(where rp.featured_position is not null),'{}'::uuid[]) into featured
 from portfolio.release_projects rp where rp.release_id=(select active_release_id from portfolio.site_state);
 select coalesce((select r.site_revision_id from portfolio.releases r where r.id=(select active_release_id from portfolio.site_state)),p_site) into sid;
 return public.publish_portfolio(array_append(revisions,p_revision),sid,featured,p_expected);
end $$;

create function public.admin_media(p_media uuid) returns text language plpgsql stable security definer set search_path='' as $$
begin
 if not portfolio.is_admin() then raise exception 'Administration requise' using errcode='42501'; end if;
 return (select object_key from portfolio.media where id=p_media and kind='image' and validated);
end $$;
revoke all on function portfolio.working_revision(uuid) from public,anon,authenticated;
revoke all on function public.admin_session(),public.admin_projects(),public.admin_save_project(uuid,uuid,jsonb),public.admin_publish_project(uuid,uuid,uuid,bigint),public.admin_media(uuid) from public,anon;
grant execute on function public.admin_session(),public.admin_projects(),public.admin_save_project(uuid,uuid,jsonb),public.admin_publish_project(uuid,uuid,uuid,bigint),public.admin_media(uuid) to authenticated;
commit;

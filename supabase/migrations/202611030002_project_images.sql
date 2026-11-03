begin;
alter table portfolio.media add column deleting boolean not null default false;
create table portfolio.image_imports (
 id uuid primary key default gen_random_uuid(), actor uuid not null references auth.users(id),
 original_name text not null check(length(original_name) between 1 and 180),
 declared_mime text not null check(declared_mime in('image/jpeg','image/png','image/webp')),
 declared_bytes integer not null check(declared_bytes between 1 and 6291456),
 incoming_key text not null unique, final_key text not null unique,
 state text not null default 'pending' check(state in('pending','validating','ready','rejected','cleanup','deleted')),
 media_id uuid references portfolio.media(id) on delete set null,
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '135 minutes',
 lease_until timestamptz, failure text, incoming_cleaned boolean not null default false
);
alter table portfolio.image_imports enable row level security;
create policy admin_read on portfolio.image_imports for select to authenticated using(portfolio.is_admin());
grant select on portfolio.image_imports to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('portfolio-incoming','portfolio-incoming',false,6291456,array['image/jpeg','image/png','image/webp']);
-- No client SELECT/INSERT/UPDATE/DELETE policies for quarantine. Only a single-path
-- signed upload capability may write there; service validation reads the bytes.

create function portfolio.require_ready_image() returns trigger language plpgsql security definer set search_path='' as $$
declare m portfolio.media;
begin
 select * into m from portfolio.media where id=new.media_id for update;
 if not found or m.deleting or m.kind<>'image' or (not m.validated and auth.uid() is not null) then raise exception 'Image en attente, absente ou supprimée' using errcode='22023'; end if;
 return new;
end $$;
create trigger require_ready_image before insert or update on portfolio.revision_media for each row execute function portfolio.require_ready_image();

create function public.admin_begin_image(p_name text,p_mime text,p_bytes integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare iid uuid:=gen_random_uuid(); ext text; result portfolio.image_imports;
begin
 if not portfolio.is_admin() then raise exception 'Administration requise' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if (select count(*) from portfolio.image_imports where actor=auth.uid() and created_at>now()-interval '24 hours')>=100
 or (select count(*) from portfolio.image_imports where actor=auth.uid() and state in('pending','validating') and expires_at>now())>=20 then raise exception 'Trop d’imports : nettoyer ou attendre' using errcode='PT429'; end if;
 ext:=case p_mime when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp' else null end;
 if ext is null or p_bytes is null or p_bytes not between 1 and 6291456 or p_name is null or length(p_name) not between 1 and 180 then raise exception 'Format ou poids invalide' using errcode='22023'; end if;
 insert into portfolio.image_imports(id,actor,original_name,declared_mime,declared_bytes,incoming_key,final_key)
 values(iid,auth.uid(),p_name,p_mime,p_bytes,'incoming/'||auth.uid()||'/'||iid||'.'||ext,'uploads/'||iid||'/'||iid||'.webp') returning * into result;
 return jsonb_build_object('id',result.id,'incomingKey',result.incoming_key);
end $$;

create function portfolio.assert_actor(p_actor uuid) returns void language plpgsql security definer set search_path='' as $$
begin if not exists(select 1 from portfolio.admin_members where user_id=p_actor and active) then raise exception 'Administration requise' using errcode='42501'; end if; end $$;

create function public.service_image_claim(p_id uuid,p_actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare i portfolio.image_imports;
begin
 perform portfolio.assert_actor(p_actor);
 select * into strict i from portfolio.image_imports where id=p_id for update;
 if i.actor<>p_actor then raise exception 'Import non autorisé' using errcode='42501'; end if;
 if i.state='ready' then return to_jsonb(i); end if;
 if i.expires_at<now() or i.state not in('pending','validating') then raise exception 'Import expiré ou refusé' using errcode='22023'; end if;
 if i.state='validating' and i.lease_until>now() then raise exception 'Validation déjà en cours, réessayer dans une minute' using errcode='PT409'; end if;
 update portfolio.image_imports set state='validating',lease_until=now()+interval '60 seconds' where id=p_id returning * into i;
 return to_jsonb(i);
end $$;

create function public.service_image_finish(p_id uuid,p_actor uuid,p_bytes integer,p_width integer,p_height integer,p_sha text) returns uuid
language plpgsql security definer set search_path='' as $$
declare i portfolio.image_imports;
begin
 perform portfolio.assert_actor(p_actor);
 select * into strict i from portfolio.image_imports where id=p_id for update;
 if i.actor<>p_actor then raise exception 'Import non autorisé' using errcode='42501'; end if;
 if i.state='ready' then return i.media_id; end if;
 if i.state<>'validating' or i.lease_until<now() then raise exception 'Validation expirée' using errcode='PT409'; end if;
 if p_bytes not between 1 and 3145728 or p_width not between 1 and 6000 or p_height not between 1 and 6000 or p_width::bigint*p_height>20000000 then raise exception 'Dimensions ou poids invalides' using errcode='22023'; end if;
 if not exists(select 1 from storage.objects where bucket_id='portfolio-private' and name=i.final_key) then raise exception 'Fichier absent'; end if;
 insert into portfolio.media(id,object_key,kind,mime,bytes,width,height,sha256,validated)
 values(i.id,i.final_key,'image','image/webp',p_bytes,p_width,p_height,p_sha,true);
 update portfolio.image_imports set state='ready',media_id=i.id,lease_until=null,failure=null where id=p_id;
 return i.id;
end $$;
create function public.service_image_fail(p_id uuid,p_actor uuid,p_reject boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 perform portfolio.assert_actor(p_actor);
 update portfolio.image_imports set state=case when p_reject then 'rejected' else 'pending' end,lease_until=null,failure=case when p_reject then 'Fichier non conforme' else 'Service interrompu' end
 where id=p_id and actor=p_actor and state='validating';
end $$;

create function portfolio.image_dependencies(p_media uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('versions',coalesce((select jsonb_agg(jsonb_build_object('title',r.title,'revisionId',r.id,'published',exists(select 1 from portfolio.release_projects rp where rp.revision_id=r.id)))
 from portfolio.revision_media g join portfolio.project_revisions r on r.id=g.revision_id where g.media_id=p_media),'[]'::jsonb),
 'siteReferences',(select count(*) from portfolio.site_revisions where p_media=any(array[hero_media_id,portrait_media_id,pdf_media_id]))+(select count(*) from portfolio.services where media_id=p_media),
 'derivatives',(select count(*) from portfolio.media_derivatives where media_id=p_media or parent_id=p_media))
$$;
create function public.admin_image_library() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not portfolio.is_admin() then raise exception 'Administration requise' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(x.data order by x.created_at desc) from (
 select i.created_at,jsonb_build_object('id',m.id,'name',i.original_name,'width',m.width,'height',m.height,'deleting',m.deleting,'dependencies',portfolio.image_dependencies(m.id)) data
 from portfolio.image_imports i join portfolio.media m on m.id=i.media_id where i.state='ready' order by i.created_at desc limit 100) x),'[]'::jsonb);
end $$;
create function public.service_image_delete_claim(p_media uuid,p_actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare m portfolio.media; d jsonb;
begin
 perform portfolio.assert_actor(p_actor);
 select * into strict m from portfolio.media where id=p_media and kind='image' for update;
 d:=portfolio.image_dependencies(m.id);
 if jsonb_array_length(d->'versions')>0 or (d->>'siteReferences')::integer>0 or (d->>'derivatives')::integer>0 then
 raise exception 'Fichier encore utilisé par une publication ou une version conservée' using errcode='PT409',detail=d::text; end if;
 update portfolio.media set deleting=true,validated=false where id=m.id;
 return jsonb_build_object('key',m.object_key);
end $$;
create function public.service_image_delete_finish(p_media uuid,p_actor uuid) returns void language plpgsql security definer set search_path='' as $$
declare k text;
begin
 perform portfolio.assert_actor(p_actor);
 select object_key into k from portfolio.media where id=p_media and deleting for update;
 if k is null then return; end if;
 if exists(select 1 from storage.objects where bucket_id='portfolio-private' and name=k) then raise exception 'Binaire encore présent'; end if;
 update portfolio.image_imports set state='deleted',media_id=null where media_id=p_media;
 delete from portfolio.media where id=p_media and deleting;
end $$;

create function public.service_image_cleanup(p_actor uuid,p_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb:='[]'; i portfolio.image_imports;
begin
 perform portfolio.assert_actor(p_actor);
 for i in select * from portfolio.image_imports where expires_at<now() and not incoming_cleaned and (p_id is null or id=p_id) and (lease_until is null or lease_until<now()) order by created_at limit 20 for update skip locked loop
   -- Ready originals can be purged; their final file/registry are never cleanup targets.
   if i.state not in('ready','deleted') then update portfolio.image_imports set state='cleanup',lease_until=null where id=i.id; end if;
   result:=result||jsonb_build_array(jsonb_build_object('id',i.id,'incomingKey',i.incoming_key,'finalKey',case when i.media_id is null then i.final_key else null end));
 end loop;
 return result;
end $$;
create function public.service_image_cleanup_finish(p_id uuid,p_actor uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform portfolio.assert_actor(p_actor);
 update portfolio.image_imports set state=case when state='cleanup' then 'deleted' else state end,incoming_cleaned=true where id=p_id and expires_at<now();
end $$;
-- Binary deletion remains protected by the existing reference trigger. New gallery
-- references must lock/check readiness, so they cannot race a deletion claim.
revoke all on function portfolio.require_ready_image(),portfolio.assert_actor(uuid),portfolio.image_dependencies(uuid) from public,anon,authenticated;
revoke all on function public.admin_begin_image(text,text,integer),public.admin_image_library() from public,anon;
grant execute on function public.admin_begin_image(text,text,integer),public.admin_image_library() to authenticated;
revoke all on function public.service_image_claim(uuid,uuid),public.service_image_finish(uuid,uuid,integer,integer,integer,text),public.service_image_fail(uuid,uuid,boolean),public.service_image_delete_claim(uuid,uuid),public.service_image_delete_finish(uuid,uuid),public.service_image_cleanup(uuid,uuid),public.service_image_cleanup_finish(uuid,uuid) from public,anon,authenticated;
grant execute on function public.service_image_claim(uuid,uuid),public.service_image_finish(uuid,uuid,integer,integer,integer,text),public.service_image_fail(uuid,uuid,boolean),public.service_image_delete_claim(uuid,uuid),public.service_image_delete_finish(uuid,uuid),public.service_image_cleanup(uuid,uuid),public.service_image_cleanup_finish(uuid,uuid) to service_role;
commit;

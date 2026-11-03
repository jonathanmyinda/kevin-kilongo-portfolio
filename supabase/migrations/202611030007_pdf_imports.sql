begin;
create table portfolio.pdf_imports(
 id uuid primary key default gen_random_uuid(),actor uuid not null references auth.users(id),original_name text not null check(length(original_name) between 1 and 180),declared_bytes integer not null check(declared_bytes between 1 and 20971520),incoming_key text not null unique,final_key text not null unique,
 state text not null default 'pending' check(state in('pending','validating','ready','rejected','cleanup','deleted')),media_id uuid references portfolio.media(id) on delete set null,
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '27 hours',lease_until timestamptz,incoming_cleaned boolean not null default false
);
alter table portfolio.pdf_imports enable row level security;
create policy admin_read on portfolio.pdf_imports for select to authenticated using(portfolio.is_admin()); grant select on portfolio.pdf_imports to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('portfolio-pdf-incoming','portfolio-pdf-incoming',false,20971520,array['application/pdf']);
create function public.admin_begin_pdf(p_name text,p_bytes integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare i portfolio.pdf_imports; iid uuid:=gen_random_uuid();
begin
 if not portfolio.is_admin() then raise exception 'Administration requise' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 if (select count(*) from portfolio.pdf_imports where actor=auth.uid() and created_at>now()-interval '24 hours')>=10 or (select count(*) from portfolio.pdf_imports where actor=auth.uid() and state in('pending','validating') and expires_at>now())>=5 then raise exception 'Trop d’imports PDF' using errcode='PT429'; end if;
 insert into portfolio.pdf_imports(id,actor,original_name,declared_bytes,incoming_key,final_key) values(iid,auth.uid(),p_name,p_bytes,'incoming/'||auth.uid()||'/'||iid||'.pdf','uploads/'||iid||'/'||iid||'.pdf') returning * into i;
 return jsonb_build_object('id',i.id,'incomingKey',i.incoming_key);
end $$;
create function public.admin_pdf_info(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin if not portfolio.is_admin() then raise exception 'Administration requise' using errcode='42501'; end if;
 return (select jsonb_build_object('id',id,'key',object_key,'bytes',bytes,'pages',pages) from portfolio.media where id=p_id and kind='pdf' and validated and not deleting);
end $$;
create function public.admin_pdf_library() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin if not portfolio.is_admin() then raise exception 'Administration requise' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',coalesce(i.original_name,regexp_replace(m.legacy_path,'^.*/',''),'portfolio.pdf'),'bytes',m.bytes,'pages',m.pages,'deleting',m.deleting,'dependencies',portfolio.image_dependencies(m.id))) from portfolio.media m left join portfolio.pdf_imports i on i.media_id=m.id where m.kind='pdf' and (m.validated or m.deleting)),'[]');
end $$;
create function public.service_pdf(p_action text,p_id uuid,p_actor uuid,p_meta jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare i portfolio.pdf_imports; m portfolio.media; d jsonb; result jsonb:='[]';
begin
 perform portfolio.assert_actor(p_actor);
 if p_action='cleanup' then
 for i in select x.* from portfolio.pdf_imports x where x.expires_at<now() and (p_id is null or x.id=p_id) and (x.lease_until is null or x.lease_until<now()) and (not x.incoming_cleaned or exists(select 1 from storage.objects o where o.bucket_id='portfolio-pdf-incoming' and o.name=x.incoming_key) or (x.media_id is null and exists(select 1 from storage.objects o where o.bucket_id='portfolio-private' and o.name=x.final_key))) order by x.created_at limit 10 for update skip locked loop
 if i.state not in('ready','deleted') then update portfolio.pdf_imports set state='cleanup',lease_until=null where id=i.id; end if;
 result:=result||jsonb_build_array(jsonb_build_object('id',i.id,'incomingKey',i.incoming_key,'finalKey',case when i.media_id is null then i.final_key else null end)); end loop; return result;
 elsif p_action='cleanup-finish' then
 update portfolio.pdf_imports set state=case when state='cleanup' then 'deleted' else state end,incoming_cleaned=true where id=p_id and expires_at<now(); return '{}';
 elsif p_action='delete-claim' then
 select * into strict m from portfolio.media where id=p_id and kind='pdf' for update;
 d:=portfolio.image_dependencies(m.id);
 if jsonb_array_length(d->'versions')>0 or (d->>'siteReferences')::integer>0 or (d->>'derivatives')::integer>0 then raise exception 'PDF référencé par une version conservée' using errcode='PT409'; end if;
 update portfolio.media set deleting=true,validated=false where id=p_id; return jsonb_build_object('key',m.object_key);
 elsif p_action='delete-finish' then
 select * into m from portfolio.media where id=p_id and kind='pdf' and deleting for update;
 if not found then return '{}'; end if;
 if exists(select 1 from storage.objects where bucket_id='portfolio-private' and name=m.object_key) then raise exception 'Binaire encore présent'; end if;
 update portfolio.pdf_imports set state='deleted',media_id=null where media_id=p_id; delete from portfolio.media where id=p_id and deleting; return '{}';
 end if;
 select * into strict i from portfolio.pdf_imports where id=p_id for update;
 if i.actor<>p_actor then raise exception 'Import non autorisé' using errcode='42501'; end if;
 if p_action='claim' then
 if i.state='ready' then return to_jsonb(i); end if;
 if i.state not in('pending','validating') or i.expires_at<now() then raise exception 'Import expiré ou refusé' using errcode='22023'; end if;
 if i.state='validating' and i.lease_until>now() then raise exception 'Validation déjà en cours' using errcode='PT409'; end if;
 update portfolio.pdf_imports set state='validating',lease_until=now()+interval '5 minutes' where id=p_id returning * into i; return to_jsonb(i);
 elsif p_action='finish' then
 if i.state='ready' then return jsonb_build_object('id',i.media_id); end if;
 if i.state<>'validating' or i.lease_until<now() then raise exception 'Validation expirée' using errcode='PT409'; end if;
 if (p_meta->>'bytes')::integer is distinct from i.declared_bytes or (p_meta->>'pages')::integer not between 1 and 100 or not exists(select 1 from storage.objects where bucket_id='portfolio-private' and name=i.final_key) then raise exception 'PDF invalide' using errcode='22023'; end if;
 insert into portfolio.media(id,object_key,kind,mime,bytes,sha256,validated,pages) values(i.id,i.final_key,'pdf','application/pdf',i.declared_bytes,p_meta->>'sha',true,(p_meta->>'pages')::integer);
 update portfolio.pdf_imports set state='ready',media_id=i.id,lease_until=null where id=p_id; return jsonb_build_object('id',i.id);
 elsif p_action='fail' then
 update portfolio.pdf_imports set state=case when (p_meta->>'reject')::boolean then 'rejected' else 'pending' end,lease_until=null where id=p_id and state='validating'; return '{}';
 end if;
 raise exception 'Action inconnue' using errcode='22023';
end $$;
revoke all on function public.admin_begin_pdf(text,integer),public.admin_pdf_info(uuid),public.admin_pdf_library() from public,anon;
grant execute on function public.admin_begin_pdf(text,integer),public.admin_pdf_info(uuid),public.admin_pdf_library() to authenticated;
revoke all on function public.service_pdf(text,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.service_pdf(text,uuid,uuid,jsonb) to service_role;
commit;

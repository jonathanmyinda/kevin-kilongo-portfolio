begin;
create or replace function portfolio.protect_storage_delete() returns trigger language plpgsql security definer set search_path='' as $$
declare m uuid;
begin
 if old.bucket_id<>'portfolio-private' then return old; end if;
 select id into m from portfolio.media where object_key=old.name for update;
 if exists(select 1 from portfolio.revision_media where media_id=m)
 or exists(select 1 from portfolio.site_revisions where m=any(array[hero_media_id,portrait_media_id,pdf_media_id]))
 or exists(select 1 from portfolio.services where media_id=m)
 or exists(select 1 from portfolio.media_derivatives where media_id=m or parent_id=m)
 then raise exception 'Média référencé : suppression interdite'; end if;
 return old;
end $$;
commit;

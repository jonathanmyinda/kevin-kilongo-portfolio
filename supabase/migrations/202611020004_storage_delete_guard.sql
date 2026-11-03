begin;
-- Even a future server cleanup must detach dependencies first. Prevent races by
-- locking the media registry row also used by FK reference acquisition.
create function portfolio.protect_storage_delete() returns trigger language plpgsql security definer set search_path='' as $$
declare m uuid;
begin
 if old.bucket_id<>'portfolio-private' then return old; end if;
 select id into m from portfolio.media where object_key=old.name for update;
 if exists(select 1 from portfolio.revision_media where media_id=m)
 or exists(select 1 from portfolio.site_revisions where m=any(array[hero_media_id,portrait_media_id,pdf_media_id]))
 or exists(select 1 from portfolio.services where media_id=m) then raise exception 'Média référencé : suppression interdite'; end if;
 return old;
end $$;
create trigger protect_portfolio_delete before delete on storage.objects for each row execute function portfolio.protect_storage_delete();
create function portfolio.protect_storage_update() returns trigger language plpgsql set search_path='' as $$
begin if old.bucket_id='portfolio-private' and (old.name<>new.name or old.bucket_id<>new.bucket_id or (old.metadata is distinct from new.metadata and exists(select 1 from portfolio.media where object_key=old.name and validated))) then raise exception 'Objet immuable : importer un nouveau fichier'; end if; return new; end $$;
create trigger protect_portfolio_update before update on storage.objects for each row execute function portfolio.protect_storage_update();
revoke all on function portfolio.protect_storage_delete(),portfolio.protect_storage_update() from public,anon,authenticated;
commit;

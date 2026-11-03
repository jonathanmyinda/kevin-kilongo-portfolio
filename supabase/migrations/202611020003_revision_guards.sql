begin;
create or replace function portfolio.freeze_published() returns trigger language plpgsql security definer set search_path='' as $$
declare ids uuid[]; sites uuid[];
begin
 if tg_table_name='project_revisions' then
  if tg_op='UPDATE' and (new.id<>old.id or new.project_id<>old.project_id) then raise exception 'Identité immuable'; end if;
  ids:=array[old.id];
 elsif tg_table_name='revision_media' then ids:=array[old.revision_id,(to_jsonb(new)->>'revision_id')::uuid];
 elsif tg_table_name='site_revisions' then
  if tg_op='UPDATE' and new.id<>old.id then raise exception 'Identité immuable'; end if;
  sites:=array[old.id];
 else sites:=array[old.site_revision_id,(to_jsonb(new)->>'site_revision_id')::uuid]; end if;
 perform 1 from portfolio.project_revisions where id=any(ids) order by id for update;
 perform 1 from portfolio.site_revisions where id=any(sites) order by id for update;
 if exists(select 1 from portfolio.release_projects where revision_id=any(ids))
 or exists(select 1 from portfolio.releases where site_revision_id=any(sites)) then raise exception 'Publication immuable : créer une nouvelle révision'; end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create or replace function portfolio.guard_insert() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='revision_media' then
 perform 1 from portfolio.project_revisions where id=new.revision_id for update;
 if exists(select 1 from portfolio.release_projects where revision_id=new.revision_id) then raise exception 'Version publiée'; end if;
 else
 perform 1 from portfolio.site_revisions where id=new.site_revision_id for update;
 if exists(select 1 from portfolio.releases where site_revision_id=new.site_revision_id) then raise exception 'Version publiée'; end if;
 end if; return new;
end $$;
create function portfolio.freeze_slug() returns trigger language plpgsql set search_path='' as $$
begin if new.id<>old.id or new.slug<>old.slug or new.legacy_id is distinct from old.legacy_id then raise exception 'Identité et URL immuables'; end if; return new; end $$;
create trigger freeze_slug before update on portfolio.projects for each row execute function portfolio.freeze_slug();
revoke all on function portfolio.freeze_slug() from public,anon,authenticated;
commit;

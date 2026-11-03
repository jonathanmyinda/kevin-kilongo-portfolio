begin;
create schema if not exists portfolio;
revoke all on schema portfolio from public, anon;
grant usage on schema portfolio to authenticated;

create table portfolio.admin_members (
  user_id uuid primary key references auth.users(id), active boolean not null default true
);
create function portfolio.is_admin() returns boolean language sql stable security definer
set search_path = '' as $$ select exists(select 1 from portfolio.admin_members where user_id=auth.uid() and active) $$;
revoke all on function portfolio.is_admin() from public, anon;
grant execute on function portfolio.is_admin() to authenticated;

create table portfolio.projects (
 id uuid primary key default gen_random_uuid(), legacy_id text unique,
 slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), archived boolean not null default false
);
create table portfolio.media (
 id uuid primary key default gen_random_uuid(), object_key text not null unique,
 kind text not null check(kind in ('image','pdf')),
 mime text not null check(mime in ('image/jpeg','image/png','image/webp','application/pdf')),
 bytes bigint not null check(bytes>0 and bytes<=20971520),
 width integer, height integer, sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 validated boolean not null default false, legacy_path text,
 check((kind='pdf' and mime='application/pdf') or
 (kind='image' and mime like 'image/%' and bytes<=10485760 and width>0 and height>0 and width::bigint*height<=30000000))
);
create table portfolio.project_revisions (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references portfolio.projects(id),
 title text not null check(length(title) between 1 and 180), description text not null,
 category text not null, location text, mission text not null, agency text, context text,
 internal jsonb not null default '{}', created_at timestamptz not null default now(),
 unique(id,project_id)
);
create table portfolio.revision_media (
 revision_id uuid not null references portfolio.project_revisions(id),
 media_id uuid not null references portfolio.media(id), position integer not null check(position>=0),
 alt text not null check(length(alt)>0), caption text, credit text, cover boolean not null default false,
 primary key(revision_id,media_id), unique(revision_id,position)
);
create unique index one_cover on portfolio.revision_media(revision_id) where cover;
create table portfolio.site_revisions (
 id uuid primary key default gen_random_uuid(), name text not null, profession text not null,
 location text not null, presentation text not null, signature_home text not null, signature_about text not null,
 email text not null, phone text not null, whatsapp text not null,
 hero_media_id uuid not null references portfolio.media(id), portrait_media_id uuid not null references portfolio.media(id),
 pdf_media_id uuid not null references portfolio.media(id), internal jsonb not null default '{}'
);
create table portfolio.services (
 site_revision_id uuid not null references portfolio.site_revisions(id), position integer not null check(position>=0),
 title text not null, description text not null, media_id uuid references portfolio.media(id),
 alt text, credit text, primary key(site_revision_id,position)
);
create table portfolio.social_links (
 site_revision_id uuid not null references portfolio.site_revisions(id), position integer not null check(position>=0),
 label text not null, url text not null check(url ~ '^https://'), primary key(site_revision_id,position)
);
create table portfolio.releases (
 id uuid primary key default gen_random_uuid(), site_revision_id uuid not null references portfolio.site_revisions(id),
 created_at timestamptz not null default now(), created_by uuid references auth.users(id)
);
create table portfolio.release_projects (
 release_id uuid not null references portfolio.releases(id), project_id uuid not null references portfolio.projects(id),
 revision_id uuid not null, featured_position integer check(featured_position>=0),
 primary key(release_id,project_id), unique(release_id,featured_position),
 foreign key(revision_id,project_id) references portfolio.project_revisions(id,project_id)
);
create table portfolio.site_state (
 singleton boolean primary key default true check(singleton), active_release_id uuid references portfolio.releases(id),
 version bigint not null default 0
);
insert into portfolio.site_state(singleton) values(true);
create table portfolio.publication_events (
 id bigint generated always as identity primary key, actor uuid, release_id uuid references portfolio.releases(id),
 action text not null, created_at timestamptz not null default now()
);
-- RLS is defence in depth even though this schema is not exposed by PostgREST.
do $$ declare t text; begin
 foreach t in array array['admin_members','projects','media','project_revisions','revision_media','site_revisions','services','social_links','releases','release_projects','site_state','publication_events'] loop
 execute format('alter table portfolio.%I enable row level security',t);
 execute format('create policy admin_read on portfolio.%I for select to authenticated using (portfolio.is_admin())',t);
 execute format('grant select on portfolio.%I to authenticated',t);
 end loop;
 foreach t in array array['projects','project_revisions','revision_media','site_revisions','services','social_links'] loop
 execute format('create policy admin_write on portfolio.%I for all to authenticated using (portfolio.is_admin()) with check (portfolio.is_admin())',t);
 execute format('grant insert,update,delete on portfolio.%I to authenticated',t);
 end loop;
end $$;
-- No grants for membership writes, media validation, releases or active pointer.
create function portfolio.freeze_published() returns trigger language plpgsql security definer set search_path='' as $$
declare used boolean; rid uuid; sid uuid;
begin
 if tg_table_name='project_revisions' then rid:=old.id;
 elsif tg_table_name='revision_media' then rid:=old.revision_id;
 elsif tg_table_name='site_revisions' then sid:=old.id;
 else sid:=old.site_revision_id; end if;
 select exists(select 1 from portfolio.release_projects where revision_id=rid)
 or exists(select 1 from portfolio.releases where site_revision_id=sid) into used;
 if used then raise exception 'Publication immuable : créer une nouvelle révision'; end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['project_revisions','revision_media','site_revisions','services','social_links'] loop
 execute format('create trigger guard_published before update or delete on portfolio.%I for each row execute function portfolio.freeze_published()',t);
 end loop;
end $$;
-- Inserting additional gallery/service rows into published revisions must also fail.
create function portfolio.guard_insert() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='revision_media' then
 if exists(select 1 from portfolio.release_projects where revision_id=new.revision_id) then raise exception 'Version publiée'; end if;
 else
 if exists(select 1 from portfolio.releases where site_revision_id=new.site_revision_id) then raise exception 'Version publiée'; end if;
 end if; return new;
end $$;
create trigger freeze_insert before insert on portfolio.revision_media for each row execute function portfolio.guard_insert();
create trigger freeze_insert before insert on portfolio.services for each row execute function portfolio.guard_insert();
create trigger freeze_insert before insert on portfolio.social_links for each row execute function portfolio.guard_insert();
revoke all on all functions in schema portfolio from public,anon;
commit;

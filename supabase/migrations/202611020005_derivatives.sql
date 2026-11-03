begin;
create table portfolio.media_derivatives (
 parent_id uuid not null references portfolio.media(id),
 media_id uuid not null references portfolio.media(id),
 primary key(parent_id,media_id), check(parent_id<>media_id)
);
alter table portfolio.media_derivatives enable row level security;
create policy admin_read on portfolio.media_derivatives for select to authenticated using(portfolio.is_admin());
grant select on portfolio.media_derivatives to authenticated;
-- Derivatives are registered by the trusted validator/importer only. Their FKs
-- also prevent deleting the registry entry of a still-used variant.
commit;

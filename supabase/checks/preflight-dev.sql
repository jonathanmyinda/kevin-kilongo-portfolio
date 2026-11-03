-- READ ONLY. Open only in the Dashboard project:
-- kevin-portfolio-dev / pahbwurduwagdglpslos
-- The label below is an expected value, NOT evidence of the server identity.
-- Confirm the actual project ref in the Dashboard URL before running.
-- Single result: Management API returns only the final statement's result.
select current_database() as database_name, session_user as connection_role,
       to_regnamespace('portfolio') is not null as portfolio_schema_already_exists,
       to_regclass('supabase_migrations.schema_migrations') is not null as migration_history_exists,
       (select jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename) order by schemaname,tablename)
        from pg_tables where schemaname in ('public','portfolio','supabase_migrations')) as tables,
       (select jsonb_agg(jsonb_build_object('name',name,'available',default_version,'installed',installed_version))
        from pg_available_extensions where name='pgtap') as pgtap,
       (select count(*) from auth.users) as existing_auth_users,
       (select count(*) from storage.buckets) as existing_storage_buckets;

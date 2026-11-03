begin;
-- Respect pg-safeupdate as enforced by PostgREST. The singleton is explicit;
-- do not disable safe updates to make a privileged function succeed.
do $$ declare definition text; corrected text; begin
 definition:=pg_get_functiondef('public.admin_save_site(uuid,jsonb)'::regprocedure);
 corrected:=replace(definition,'update portfolio.site_workspace set revision_id=rid;','update portfolio.site_workspace set revision_id=rid where singleton;');
 if corrected=definition then raise exception 'Fonction inattendue : correctif non appliqué'; end if;
 execute corrected;
end $$;
commit;

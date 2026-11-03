begin;
-- A first project publication must use the known initial profile, never a
-- random unpublished site revision selected by UUID ordering.
alter table portfolio.site_workspace add column baseline_revision_id uuid references portfolio.site_revisions(id);
update portfolio.site_workspace set baseline_revision_id=portfolio.working_site() where singleton;
do $$ declare definition text; corrected text; begin
 definition:=pg_get_functiondef('public.admin_projects()'::regprocedure);
 corrected:=replace(definition,'(select id from portfolio.site_revisions order by id limit 1)','(select baseline_revision_id from portfolio.site_workspace)');
 if definition=corrected then raise exception 'Lecture projets inattendue'; end if; execute corrected;
 definition:=pg_get_functiondef('public.admin_publish_project(uuid,uuid,uuid,bigint)'::regprocedure);
 corrected:=replace(definition,'p_site) into sid;','(select baseline_revision_id from portfolio.site_workspace)) into sid;');
 if definition=corrected then raise exception 'Publication projets inattendue'; end if; execute corrected;
end $$;
commit;

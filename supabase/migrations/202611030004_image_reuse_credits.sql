begin;
-- Reusing a validated file should retain its latest recorded captions/credits.
-- The authoritative values remain versioned in each project's gallery.
create or replace function public.admin_image_library() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not portfolio.is_admin() then raise exception 'Administration requise' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(x.data order by x.created_at desc) from (
 select i.created_at,jsonb_build_object('id',m.id,'name',i.original_name,'width',m.width,'height',m.height,'deleting',m.deleting,
 'defaults',coalesce((select jsonb_build_object('alt',g.alt,'caption',g.caption,'credit',g.credit)
 from portfolio.revision_media g join portfolio.project_revisions r on r.id=g.revision_id
 where g.media_id=m.id order by r.created_at desc,r.id desc limit 1),'{}'::jsonb),
 'dependencies',portfolio.image_dependencies(m.id)) data
 from portfolio.image_imports i join portfolio.media m on m.id=i.media_id where i.state='ready' order by i.created_at desc limit 100) x),'[]'::jsonb);
end $$;
commit;

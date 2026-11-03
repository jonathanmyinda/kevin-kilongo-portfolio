begin;
alter table portfolio.site_revisions add column home_subtitle text not null default '',add column approach text not null default '',add column hero_alt text not null default '',add column hero_credit text,add column portrait_alt text not null default '',add column portrait_credit text,add column pdf_download_name text not null default 'portfolio-kevin-kilongo-munganga.pdf',add column created_at timestamptz not null default now();
alter table portfolio.media add column pages integer check(pages between 1 and 100);
create table portfolio.site_workspace(singleton boolean primary key default true check(singleton),revision_id uuid references portfolio.site_revisions(id));
insert into portfolio.site_workspace(singleton) values(true);
alter table portfolio.site_workspace enable row level security;
create policy admin_read on portfolio.site_workspace for select to authenticated using(portfolio.is_admin());
grant select on portfolio.site_workspace to authenticated;
create function portfolio.working_site() returns uuid language sql stable set search_path='' as $$
 select coalesce((select revision_id from portfolio.site_workspace),(select r.site_revision_id from portfolio.site_state st join portfolio.releases r on r.id=st.active_release_id),(select id from portfolio.site_revisions order by created_at,id limit 1))
$$;
create function portfolio.site_public(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('name',s.name,'profession',s.profession,'location',s.location,'headline',s.signature_home,'subtitle',s.home_subtitle,'presentation',s.presentation,'approach',s.approach,'signatureAbout',s.signature_about,'email',s.email,'phone',s.phone,'whatsapp',s.whatsapp,
 'heroMediaId',s.hero_media_id,'heroAlt',s.hero_alt,'heroCredit',s.hero_credit,'portraitMediaId',s.portrait_media_id,'portraitAlt',s.portrait_alt,'portraitCredit',s.portrait_credit,'pdfMediaId',s.pdf_media_id,'pdfDownloadName',s.pdf_download_name,
 'pdf',jsonb_build_object('id',m.id,'bytes',m.bytes,'pages',coalesce(m.pages,case when m.sha256=s.internal->'profile'->'portfolio'->>'sha256' then (s.internal->'profile'->'portfolio'->>'pages')::integer end),'downloadName',s.pdf_download_name),
 'services',coalesce((select jsonb_agg(jsonb_build_object('title',v.title,'description',v.description,'mediaId',v.media_id,'alt',v.alt,'credit',v.credit) order by v.position) from portfolio.services v where v.site_revision_id=s.id),'[]'),
 'socials',coalesce((select jsonb_agg(jsonb_build_object('label',l.label,'url',l.url) order by l.position) from portfolio.social_links l where l.site_revision_id=s.id),'[]'))
 from portfolio.site_revisions s join portfolio.media m on m.id=s.pdf_media_id where s.id=p_id
$$;
create function public.admin_site() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare current_id uuid; published uuid;
begin
 if not portfolio.is_admin() then raise exception 'Administration requise' using errcode='42501'; end if;
 current_id:=portfolio.working_site(); select r.site_revision_id into published from portfolio.site_state st join portfolio.releases r on r.id=st.active_release_id;
 return jsonb_build_object('revisionId',current_id,'publishedRevisionId',published,'version',(select version from portfolio.site_state),'data',portfolio.site_public(current_id),
 'history',coalesce((select jsonb_agg(jsonb_build_object('revisionId',h.site_revision_id,'createdAt',h.created_at,'name',s.name,'active',h.site_revision_id=published) order by h.created_at desc) from (select site_revision_id,max(created_at) created_at from portfolio.releases group by site_revision_id) h join portfolio.site_revisions s on s.id=h.site_revision_id),'[]'));
end $$;
create function public.admin_site_preview(p_revision uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin if not portfolio.is_admin() then raise exception 'Administration requise' using errcode='42501'; end if; return portfolio.site_public(p_revision); end $$;

create function portfolio.ready_site_files() returns trigger language plpgsql security definer set search_path='' as $$
declare m portfolio.media;
begin
 for m in select * from portfolio.media where id=any(array[new.hero_media_id,new.portrait_media_id,new.pdf_media_id]) order by id for update loop
 if m.deleting or (not m.validated and auth.uid() is not null) or (m.id=new.pdf_media_id and m.kind<>'pdf') or (m.id=any(array[new.hero_media_id,new.portrait_media_id]) and m.kind<>'image') then raise exception 'Fichier non validé ou type incorrect' using errcode='22023'; end if;
 end loop; return new;
end $$;
create trigger ready_site_files before insert or update on portfolio.site_revisions for each row execute function portfolio.ready_site_files();
create function portfolio.ready_service_file() returns trigger language plpgsql security definer set search_path='' as $$
declare m portfolio.media;
begin
 if new.media_id is null then return new; end if;
 select * into strict m from portfolio.media where id=new.media_id for update;
 if m.deleting or m.kind<>'image' or (not m.validated and auth.uid() is not null) then raise exception 'Image non validée' using errcode='22023'; end if; return new;
end $$;
create trigger ready_service_file before insert or update on portfolio.services for each row execute function portfolio.ready_service_file();

create function public.admin_save_site(p_expected uuid,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare previous uuid; rid uuid:=gen_random_uuid(); item jsonb; n integer; k text; digits text;
begin
 if not portfolio.is_admin() then raise exception 'Administration requise' using errcode='42501'; end if;
 perform 1 from portfolio.site_workspace for update; previous:=portfolio.working_site();
 if previous is distinct from p_expected then raise exception 'Brouillon modifié ailleurs' using errcode='PT409'; end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Profil invalide' using errcode='22023'; end if;
 if exists(select 1 from jsonb_object_keys(p_data) x where x<>all(array['name','profession','location','headline','subtitle','presentation','approach','signatureAbout','email','phone','heroMediaId','heroAlt','heroCredit','portraitMediaId','portraitAlt','portraitCredit','pdfMediaId','pdfDownloadName','services','socials'])) then raise exception 'Champ interdit' using errcode='22023'; end if;
 foreach k in array array['name','profession','location','headline','subtitle','presentation','approach','signatureAbout','heroAlt','portraitAlt'] loop
 if jsonb_typeof(p_data->k) is distinct from 'string' or length(trim(p_data->>k)) not between 1 and (case when k in('presentation','approach') then 10000 else 1000 end) then raise exception 'Champ requis ou trop long' using errcode='22023'; end if;
 end loop;
 if length(p_data->>'name')>180 or length(p_data->>'profession')>180 then raise exception 'Nom ou intitulé trop long' using errcode='22023'; end if;
 if coalesce(p_data->>'email','') !~ '^[A-Za-z0-9][A-Za-z0-9._+\-]*@[A-Za-z0-9.\-]+\.[A-Za-z]{2,63}$' or length(p_data->>'email')>254 then raise exception 'Email invalide' using errcode='22023'; end if;
 digits:=regexp_replace(p_data->>'phone','[^0-9]','','g');
 if coalesce(p_data->>'phone','') !~ '^\+?[0-9 ()-]{8,24}$' or digits !~ '^[1-9][0-9]{7,14}$' then raise exception 'Numéro WhatsApp invalide' using errcode='22023'; end if;
 if coalesce(p_data->>'pdfDownloadName','') !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,100}\.pdf$' then raise exception 'Nom PDF invalide' using errcode='22023'; end if;
 if jsonb_typeof(p_data->'services') is distinct from 'array' or jsonb_array_length(p_data->'services')>20 or jsonb_typeof(p_data->'socials') is distinct from 'array' or jsonb_array_length(p_data->'socials')>10 then raise exception 'Listes invalides' using errcode='22023'; end if;
 insert into portfolio.site_revisions(id,name,profession,location,signature_home,home_subtitle,presentation,approach,signature_about,email,phone,whatsapp,hero_media_id,hero_alt,hero_credit,portrait_media_id,portrait_alt,portrait_credit,pdf_media_id,pdf_download_name,internal)
 values(rid,p_data->>'name',p_data->>'profession',p_data->>'location',p_data->>'headline',p_data->>'subtitle',p_data->>'presentation',p_data->>'approach',p_data->>'signatureAbout',p_data->>'email',p_data->>'phone','https://wa.me/'||digits,(p_data->>'heroMediaId')::uuid,p_data->>'heroAlt',p_data->>'heroCredit',(p_data->>'portraitMediaId')::uuid,p_data->>'portraitAlt',p_data->>'portraitCredit',(p_data->>'pdfMediaId')::uuid,p_data->>'pdfDownloadName',coalesce((select internal from portfolio.site_revisions where id=previous),'{}'));
 n:=0;
 for item in select value from jsonb_array_elements(p_data->'services') loop
 if length(trim(coalesce(item->>'title',''))) not between 1 and 180 or length(trim(coalesce(item->>'description',''))) not between 1 and 5000 or length(coalesce(item->>'credit',''))>2000 or (item->>'mediaId' is not null and length(trim(coalesce(item->>'alt',''))) not between 1 and 1000) then raise exception 'Service invalide' using errcode='22023'; end if;
 insert into portfolio.services(site_revision_id,position,title,description,media_id,alt,credit) values(rid,n,item->>'title',item->>'description',(item->>'mediaId')::uuid,item->>'alt',item->>'credit'); n:=n+1;
 end loop;
 n:=0;
 for item in select value from jsonb_array_elements(p_data->'socials') loop
 if length(trim(coalesce(item->>'label',''))) not between 1 and 80 or coalesce(item->>'url','') !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?(/|\?|#|$)' or length(item->>'url')>500 or item->>'url' ~ '[[:space:]]' then raise exception 'Lien social invalide' using errcode='22023'; end if;
 insert into portfolio.social_links values(rid,n,item->>'label',item->>'url'); n:=n+1;
 end loop;
 update portfolio.site_workspace set revision_id=rid; return rid;
end $$;

create function public.admin_publish_site(p_revision uuid,p_expected bigint,p_restore boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare revisions uuid[]; featured uuid[];
begin
 if not portfolio.is_admin() then raise exception 'Administration requise' using errcode='42501'; end if;
 perform 1 from portfolio.site_state for update; perform 1 from portfolio.site_workspace for update;
 if p_restore then
 if not exists(select 1 from portfolio.releases where site_revision_id=p_revision) then raise exception 'Version jamais publiée' using errcode='22023'; end if;
 elsif portfolio.working_site() is distinct from p_revision then raise exception 'Brouillon modifié ailleurs' using errcode='PT409'; end if;
 select coalesce(array_agg(rp.revision_id),'{}'::uuid[]),coalesce(array_agg(rp.project_id order by rp.featured_position) filter(where rp.featured_position is not null),'{}'::uuid[]) into revisions,featured from portfolio.release_projects rp where rp.release_id=(select active_release_id from portfolio.site_state);
 return public.publish_portfolio(revisions,p_revision,featured,p_expected);
end $$;
-- Public output still resolves ONLY the active immutable publication.
alter function public.read_portfolio() set schema portfolio;
alter function portfolio.read_portfolio() rename to read_portfolio_legacy;
revoke all on function portfolio.read_portfolio_legacy() from public,anon,authenticated;
create function public.read_portfolio() returns jsonb language sql stable security definer set search_path='' as $$
 select case when base is null then null else base||jsonb_build_object('profile',(base->'profile')||(portfolio.site_public(s.site_revision_id)-'services'),'services',portfolio.site_public(s.site_revision_id)->'services') end
 from (select portfolio.read_portfolio_legacy() base) b left join portfolio.site_state st on st.singleton left join portfolio.releases s on s.id=st.active_release_id
$$;
revoke all on function portfolio.working_site(),portfolio.site_public(uuid),portfolio.ready_site_files(),portfolio.ready_service_file() from public,anon,authenticated;
revoke all on function public.admin_site(),public.admin_site_preview(uuid),public.admin_save_site(uuid,jsonb),public.admin_publish_site(uuid,bigint,boolean) from public,anon;
grant execute on function public.admin_site(),public.admin_site_preview(uuid),public.admin_save_site(uuid,jsonb),public.admin_publish_site(uuid,bigint,boolean) to authenticated;
revoke all on function public.read_portfolio() from public;
grant execute on function public.read_portfolio() to anon,authenticated,service_role;
commit;

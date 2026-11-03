begin;
-- Revisit an exact known temporary key if a timed-out worker wrote it after a
-- previous cleanup. Never scan/delete arbitrary bucket prefixes or ready finals.
create or replace function public.service_image_cleanup(p_actor uuid,p_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb:='[]'; i portfolio.image_imports;
begin
 perform portfolio.assert_actor(p_actor);
 for i in select x.* from portfolio.image_imports x
 where x.expires_at<now() and (p_id is null or x.id=p_id)
 and (x.lease_until is null or x.lease_until<now())
 and (not x.incoming_cleaned
 or exists(select 1 from storage.objects o where o.bucket_id='portfolio-incoming' and o.name=x.incoming_key)
 or (x.media_id is null and exists(select 1 from storage.objects o where o.bucket_id='portfolio-private' and o.name=x.final_key)))
 order by x.created_at limit 20 for update skip locked loop
   if i.state not in('ready','deleted') then update portfolio.image_imports set state='cleanup',lease_until=null where id=i.id; end if;
   result:=result||jsonb_build_array(jsonb_build_object('id',i.id,'incomingKey',i.incoming_key,'finalKey',case when i.media_id is null then i.final_key else null end));
 end loop;
 return result;
end $$;
commit;

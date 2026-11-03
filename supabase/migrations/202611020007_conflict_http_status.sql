begin;
-- An optimistic-version conflict is an application HTTP 409, not a database
-- serialization failure to retry. Keep the checks/locks and change only SQLSTATE.
do $migration$
declare signature text; definition text;
begin
 foreach signature in array array['public.publish_portfolio(uuid[],uuid,uuid[],bigint)','public.restore_portfolio(uuid,bigint)'] loop
  select pg_get_functiondef(signature::regprocedure) into definition;
  if position('40001' in definition)>0 then
   execute replace(definition,'''40001''','''PT409''');
  elsif position('PT409' in definition)=0 then
   raise exception 'Définition inattendue : %',signature;
  end if;
 end loop;
end $migration$;
commit;

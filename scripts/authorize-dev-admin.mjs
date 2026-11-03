// Authorize an EXISTING account only. Never creates users, sends mail or resets passwords.
import { verifyTarget, sql, quote } from './dev-tools.mjs'
verifyTarget()
const uidIndex = process.argv.indexOf('--uid')
const uid = uidIndex >= 0 ? process.argv[uidIndex + 1] : null
if (uidIndex >= 0 && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(uid ?? '')) throw new Error('UID invalide')
const email = process.env.SUPABASE_DEV_FIRST_ADMIN_EMAIL
if (!uid && (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error('Renseigner SUPABASE_DEV_FIRST_ADMIN_EMAIL dans le fichier local ignoré ou passer --uid.')
const users = sql(`select id from auth.users where ${uid ? `id=${quote(uid)}` : `lower(email)=lower(${quote(email)})`};`)
if (users.length !== 1) throw new Error('Compte Auth existant unique requis. Aucun compte créé ni invitation envoyée.')
if (!process.argv.includes('--apply')) console.log('Compte existant trouvé. Simulation uniquement ; --apply autorisera ce seul compte DEV.')
else {
  const id = quote(users[0].id)
  const result = sql(`begin;
  create temporary table other_admins_before on commit drop as select user_id,active from portfolio.admin_members where user_id<>${id};
  insert into portfolio.admin_members(user_id,active) values(${id},true) on conflict(user_id) do update set active=true;
  do $$ begin if exists((select * from other_admins_before except select user_id,active from portfolio.admin_members where user_id<>${id}) union all (select user_id,active from portfolio.admin_members where user_id<>${id} except select * from other_admins_before)) then raise exception 'Autres droits modifiés : annulation'; end if; end $$;
  commit;
  select m.user_id,m.active,u.email_confirmed_at is not null as email_confirmed from portfolio.admin_members m join auth.users u on u.id=m.user_id where m.user_id=${id};`)
  if (result.length !== 1 || !result[0].active) throw new Error('Autorisation non confirmée')
  console.log(JSON.stringify({uid:result[0].user_id,adminActive:true,emailConfirmed:result[0].email_confirmed,otherAccountsUnchanged:true}))
}

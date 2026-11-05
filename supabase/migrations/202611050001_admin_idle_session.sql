begin;

create table portfolio.admin_activity (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  last_activity timestamptz not null
);
alter table portfolio.admin_activity enable row level security;
revoke all on portfolio.admin_activity from public, anon, authenticated;

-- Keep the role check separate from the lease so the API can distinguish 403 and 401.
create or replace function public.admin_session() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from portfolio.admin_members where user_id = auth.uid() and active)
$$;

-- Existing RPCs and Storage policies also enforce the lease for Supabase Auth JWTs.
-- Trusted SQL maintenance and pgTAP set a synthetic subject without a session claim.
create or replace function portfolio.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.admin_session() and (
    (auth.jwt()->>'session_id' is null and session_user in ('postgres', 'supabase_admin')) or exists (
      select 1 from auth.sessions s left join portfolio.admin_activity a on a.session_id = s.id
      where s.id = (auth.jwt()->>'session_id')::uuid and s.user_id = auth.uid()
        and statement_timestamp() < coalesce(a.last_activity, s.created_at) + interval '30 minutes'
    )
  )
$$;

create function public.admin_idle_session(p_touch boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  session_id_claim uuid := (auth.jwt()->>'session_id')::uuid;
  last_seen timestamptz;
  observed_at timestamptz;
  deadline timestamptz;
begin
  if not public.admin_session() then return null; end if;

  -- Serialize activity and expiration across API instances and tabs.
  select s.created_at into last_seen from auth.sessions s
    where s.id = session_id_claim and s.user_id = auth.uid() for update;
  if not found then return null; end if;
  last_seen := coalesce((select a.last_activity from portfolio.admin_activity a
    where a.session_id = session_id_claim), last_seen);
  observed_at := clock_timestamp();
  deadline := last_seen + interval '30 minutes';
  if observed_at >= deadline then return null; end if;

  if p_touch then
    insert into portfolio.admin_activity values (session_id_claim, observed_at)
      on conflict (session_id) do update set last_activity = excluded.last_activity;
    deadline := observed_at + interval '30 minutes';
  end if;
  return jsonb_build_object(
    'sessionId', session_id_claim,
    'expiresAt', floor(extract(epoch from deadline) * 1000),
    'serverNow', floor(extract(epoch from observed_at) * 1000)
  );
end;
$$;
revoke all on function public.admin_idle_session(boolean) from public, anon;
grant execute on function public.admin_idle_session(boolean) to authenticated;

commit;

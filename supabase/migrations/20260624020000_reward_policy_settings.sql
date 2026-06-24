-- Server-controlled free/event talisman reward policy.
-- No retroactive grants: existing token_ledger rows remain unchanged.

create table public.reward_policy_settings (
  reward_key text primary key check (reward_key in ('signup', 'daily_login', 'rewarded_ad', 'kakao_share')),
  amount int not null check (amount >= 0),
  daily_cap int check (daily_cap is null or daily_cap >= 0),
  enabled boolean not null default true,
  note text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.reward_policy_settings (reward_key, amount, daily_cap, enabled, note)
values
  ('signup', 100, null, true, 'New signup welcome bonus'),
  ('daily_login', 10, 1, true, 'Daily authenticated app entry bonus'),
  ('rewarded_ad', 10, 3, true, 'Apps in Toss rewarded ad completion bonus'),
  ('kakao_share', 11, 5, true, 'Kakao webhook-confirmed hapcard share bonus')
on conflict (reward_key) do update
set amount = excluded.amount,
    daily_cap = excluded.daily_cap,
    enabled = excluded.enabled,
    note = excluded.note,
    updated_at = now();

create or replace function public.touch_reward_policy_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reward_policy_settings_touch_updated_at on public.reward_policy_settings;
create trigger reward_policy_settings_touch_updated_at
before update on public.reward_policy_settings
for each row
execute function public.touch_reward_policy_settings_updated_at();

revoke all on function public.touch_reward_policy_settings_updated_at() from public;
revoke execute on function public.touch_reward_policy_settings_updated_at() from anon;
revoke execute on function public.touch_reward_policy_settings_updated_at() from authenticated;
grant execute on function public.touch_reward_policy_settings_updated_at() to service_role;

alter table public.reward_policy_settings enable row level security;

revoke all on public.reward_policy_settings from anon;
revoke all on public.reward_policy_settings from authenticated;
grant all on public.reward_policy_settings to service_role;

create or replace function public.award_free_talisman_session_rewards(
  uid uuid,
  p_auth_created_at timestamptz default null,
  p_policy_effective_at timestamptz default '2026-05-25T00:00:00+09:00'::timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_signup_ref text := 'signup:' || uid::text;
  v_daily_ref text := 'daily_login:' || v_today::text;
  v_signup_amount int := 0;
  v_daily_amount int := 0;
  v_current_balance int;
  v_balance_after int;
  v_amount_awarded int := 0;
  v_signup_awarded boolean := false;
  v_daily_login_awarded boolean := false;
begin
  select coalesce((
    select amount
      from public.reward_policy_settings
     where reward_key = 'signup'
       and enabled
  ), 0)
    into v_signup_amount;

  select coalesce((
    select amount
      from public.reward_policy_settings
     where reward_key = 'daily_login'
       and enabled
  ), 0)
    into v_daily_amount;

  perform 1
    from public.users
   where user_id = uid
   for update;

  if not found then
    return jsonb_build_object(
      'awarded', false,
      'reason', 'PROFILE_REQUIRED',
      'signup_awarded', false,
      'daily_login_awarded', false,
      'amount_awarded', 0,
      'balance_after', null
    );
  end if;

  select coalesce(sum(delta), 0)
    into v_current_balance
    from public.token_ledger
   where user_id = uid;

  v_balance_after := v_current_balance;

  if v_signup_amount > 0
     and p_auth_created_at is not null
     and p_auth_created_at >= p_policy_effective_at
     and not exists (
       select 1
         from public.token_ledger
        where user_id = uid
          and reason = 'bonus'
          and reference_id = v_signup_ref
     ) then
    v_balance_after := v_balance_after + v_signup_amount;
    v_amount_awarded := v_amount_awarded + v_signup_amount;
    v_signup_awarded := true;

    insert into public.token_ledger (user_id, delta, reason, reference_id, balance_after)
    values (uid, v_signup_amount, 'bonus', v_signup_ref, v_balance_after);
  end if;

  if v_daily_amount > 0
     and not exists (
       select 1
         from public.token_ledger
        where user_id = uid
          and reason = 'bonus'
          and reference_id = v_daily_ref
     ) then
    v_balance_after := v_balance_after + v_daily_amount;
    v_amount_awarded := v_amount_awarded + v_daily_amount;
    v_daily_login_awarded := true;

    insert into public.token_ledger (user_id, delta, reason, reference_id, balance_after)
    values (uid, v_daily_amount, 'bonus', v_daily_ref, v_balance_after);
  end if;

  return jsonb_build_object(
    'awarded', v_amount_awarded > 0,
    'reason', case when v_amount_awarded > 0 then 'AWARDED' else 'ALREADY_AWARDED' end,
    'signup_awarded', v_signup_awarded,
    'daily_login_awarded', v_daily_login_awarded,
    'amount_awarded', v_amount_awarded,
    'balance_after', v_balance_after
  );
end;
$$;

revoke all on function public.award_free_talisman_session_rewards(uuid, timestamptz, timestamptz) from public;
revoke execute on function public.award_free_talisman_session_rewards(uuid, timestamptz, timestamptz) from anon;
revoke execute on function public.award_free_talisman_session_rewards(uuid, timestamptz, timestamptz) from authenticated;
grant execute on function public.award_free_talisman_session_rewards(uuid, timestamptz, timestamptz) to service_role;

create or replace function public.award_rewarded_ad_talisman(uid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_daily_cap int := 0;
  v_reward_amount int := 0;
  v_awarded_count int;
  v_current_balance int;
  v_balance_after int;
  v_reference_id text;
begin
  select coalesce(amount, 0), coalesce(daily_cap, 0)
    into v_reward_amount, v_daily_cap
    from public.reward_policy_settings
   where reward_key = 'rewarded_ad'
     and enabled;

  v_reward_amount := coalesce(v_reward_amount, 0);
  v_daily_cap := coalesce(v_daily_cap, 0);

  perform 1
    from public.users
   where user_id = uid
   for update;

  if not found then
    return jsonb_build_object(
      'awarded', false,
      'reason', 'PROFILE_REQUIRED',
      'amount_awarded', 0,
      'daily_cap', v_daily_cap,
      'balance_after', null,
      'remaining', 0
    );
  end if;

  select coalesce((
    select balance_after
      from public.token_ledger
     where user_id = uid
     order by created_at desc
     limit 1
  ), 0)
    into v_current_balance;

  select count(*)
    into v_awarded_count
    from public.token_ledger
   where user_id = uid
     and reason = 'bonus'
     and reference_id like ('ad_reward:' || v_today::text || ':%');

  if v_reward_amount <= 0 or v_awarded_count >= v_daily_cap then
    return jsonb_build_object(
      'awarded', false,
      'reason', case when v_reward_amount <= 0 then 'DISABLED' else 'DAILY_LIMIT_REACHED' end,
      'amount_awarded', 0,
      'daily_cap', v_daily_cap,
      'balance_after', v_current_balance,
      'remaining', greatest(v_daily_cap - v_awarded_count, 0)
    );
  end if;

  v_balance_after := v_current_balance + v_reward_amount;
  v_reference_id := 'ad_reward:' || v_today::text || ':' || (v_awarded_count + 1)::text;

  insert into public.token_ledger (user_id, delta, reason, reference_id, balance_after)
  values (uid, v_reward_amount, 'bonus', v_reference_id, v_balance_after);

  return jsonb_build_object(
    'awarded', true,
    'reason', 'AWARDED',
    'amount_awarded', v_reward_amount,
    'daily_cap', v_daily_cap,
    'balance_after', v_balance_after,
    'remaining', greatest(v_daily_cap - (v_awarded_count + 1), 0)
  );
end;
$$;

revoke all on function public.award_rewarded_ad_talisman(uuid) from public;
revoke execute on function public.award_rewarded_ad_talisman(uuid) from anon;
revoke execute on function public.award_rewarded_ad_talisman(uuid) from authenticated;
grant execute on function public.award_rewarded_ad_talisman(uuid) to service_role;

create or replace function public.award_hapcard_share_reward(
  p_share_id uuid,
  p_channel text,
  p_webhook_resource_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share public.hapcard_shares%rowtype;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_reward_amount int := 0;
  v_daily_cap int := 0;
  v_daily_count integer;
  v_previous_balance integer;
  v_balance_after integer;
  v_ledger_id uuid;
begin
  if p_channel <> 'kakao' then
    return jsonb_build_object('awarded', false, 'reason', 'INVALID_CHANNEL');
  end if;

  if p_webhook_resource_id is null or length(trim(p_webhook_resource_id)) = 0 then
    return jsonb_build_object('awarded', false, 'reason', 'WEBHOOK_REQUIRED');
  end if;

  if exists (
    select 1 from public.hapcard_share_rewards
     where webhook_resource_id = p_webhook_resource_id
  ) then
    return jsonb_build_object('awarded', false, 'reason', 'DUPLICATE_WEBHOOK');
  end if;

  select coalesce(amount, 0), coalesce(daily_cap, 0)
    into v_reward_amount, v_daily_cap
    from public.reward_policy_settings
   where reward_key = 'kakao_share'
     and enabled;

  v_reward_amount := coalesce(v_reward_amount, 0);
  v_daily_cap := coalesce(v_daily_cap, 0);

  select *
    into v_share
    from public.hapcard_shares
   where share_id = p_share_id
     and revoked_at is null
     and expires_at > now()
   for update;

  if not found then
    return jsonb_build_object('awarded', false, 'reason', 'SHARE_NOT_FOUND');
  end if;

  if v_share.channel <> p_channel then
    return jsonb_build_object('awarded', false, 'reason', 'CHANNEL_MISMATCH');
  end if;

  update public.hapcard_shares
     set completed_at = coalesce(completed_at, now())
   where share_id = v_share.share_id;

  perform 1
    from public.users
   where user_id = v_share.user_id
   for update;

  if exists (
    select 1 from public.hapcard_share_rewards
     where user_id = v_share.user_id
       and hapcard_id = v_share.hapcard_id
  ) then
    return jsonb_build_object('awarded', false, 'reason', 'ALREADY_AWARDED');
  end if;

  select count(*)
    into v_daily_count
    from public.hapcard_share_rewards
   where user_id = v_share.user_id
     and reward_date_kst = v_today;

  if v_reward_amount <= 0 or v_daily_count >= v_daily_cap then
    return jsonb_build_object(
      'awarded', false,
      'reason', case when v_reward_amount <= 0 then 'DISABLED' else 'DAILY_CAP_REACHED' end,
      'amount_awarded', 0,
      'daily_cap', v_daily_cap,
      'remaining', greatest(v_daily_cap - v_daily_count, 0)
    );
  end if;

  select coalesce((
    select balance_after
      from public.token_ledger
     where user_id = v_share.user_id
     order by created_at desc
     limit 1
  ), 0)
    into v_previous_balance;

  v_balance_after := v_previous_balance + v_reward_amount;

  insert into public.token_ledger (user_id, delta, reason, reference_id, balance_after)
  values (v_share.user_id, v_reward_amount, 'bonus', 'share:' || v_share.share_id::text, v_balance_after)
  returning ledger_id into v_ledger_id;

  insert into public.hapcard_share_rewards (
    user_id,
    hapcard_id,
    share_id,
    channel,
    ledger_id,
    reward_date_kst,
    webhook_resource_id
  )
  values (
    v_share.user_id,
    v_share.hapcard_id,
    v_share.share_id,
    p_channel,
    v_ledger_id,
    v_today,
    p_webhook_resource_id
  );

  return jsonb_build_object(
    'awarded', true,
    'reason', 'AWARDED',
    'amount_awarded', v_reward_amount,
    'daily_cap', v_daily_cap,
    'balance_after', v_balance_after,
    'remaining', greatest(v_daily_cap - (v_daily_count + 1), 0)
  );
end;
$$;

revoke all on function public.award_hapcard_share_reward(uuid, text, text) from public;
revoke execute on function public.award_hapcard_share_reward(uuid, text, text) from anon;
revoke execute on function public.award_hapcard_share_reward(uuid, text, text) from authenticated;
grant execute on function public.award_hapcard_share_reward(uuid, text, text) to service_role;

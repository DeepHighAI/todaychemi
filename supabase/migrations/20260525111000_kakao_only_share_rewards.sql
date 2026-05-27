-- Share rewards are only granted from server-verifiable Kakao webhook callbacks.
-- Client-reported Instagram/Web Share/copy/download completions can still share,
-- but they cannot mint free talismans.

alter table public.hapcard_share_rewards
  drop constraint if exists hapcard_share_rewards_channel_check;

alter table public.hapcard_share_rewards
  add constraint hapcard_share_rewards_channel_check
  check (channel in ('kakao'));

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

  if v_daily_count >= 5 then
    return jsonb_build_object('awarded', false, 'reason', 'DAILY_CAP_REACHED');
  end if;

  select coalesce((
    select balance_after
      from public.token_ledger
     where user_id = v_share.user_id
     order by created_at desc
     limit 1
  ), 0)
    into v_previous_balance;

  v_balance_after := v_previous_balance + 1;

  insert into public.token_ledger (user_id, delta, reason, reference_id, balance_after)
  values (v_share.user_id, 1, 'bonus', 'share:' || v_share.share_id::text, v_balance_after)
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
    'balance_after', v_balance_after
  );
end;
$$;

revoke all on function public.award_hapcard_share_reward(uuid, text, text) from public;
grant execute on function public.award_hapcard_share_reward(uuid, text, text) to service_role;

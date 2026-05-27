-- Public hapcard share tokens + share reward idempotency.
-- Raw public tokens are never stored; only token_hash is persisted.

create table public.hapcard_shares (
  share_id     uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(user_id) on delete cascade,
  hapcard_id   uuid not null references public.hapcards(hapcard_id) on delete cascade,
  relation_id  uuid not null references public.relations(relation_id) on delete cascade,
  token_hash   text not null unique,
  range        text not null check (range in ('nickname-only', 'nickname-ohaeng', 'nickname-gender')),
  channel      text not null check (channel in ('kakao', 'web_share', 'instagram', 'copy_link')),
  title        text not null,
  message_text text not null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '30 days'),
  completed_at timestamptz,
  revoked_at   timestamptz
);

create index hapcard_shares_user_created_idx on public.hapcard_shares (user_id, created_at desc);
create index hapcard_shares_hapcard_idx on public.hapcard_shares (hapcard_id);
create index hapcard_shares_expires_idx on public.hapcard_shares (expires_at);

alter table public.hapcard_shares enable row level security;
create policy "hapcard_shares_own_read" on public.hapcard_shares
  for select using (auth.uid() = user_id);
-- insert/update/delete are service_role only.

create table public.hapcard_share_rewards (
  reward_id           uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users(user_id) on delete cascade,
  hapcard_id          uuid not null references public.hapcards(hapcard_id) on delete cascade,
  share_id            uuid not null references public.hapcard_shares(share_id) on delete cascade,
  channel             text not null check (channel in ('kakao')),
  ledger_id           uuid references public.token_ledger(ledger_id) on delete set null,
  reward_date_kst     date not null default ((now() at time zone 'Asia/Seoul')::date),
  webhook_resource_id text,
  awarded_at          timestamptz not null default now(),
  unique (user_id, hapcard_id),
  unique (share_id)
);

create unique index hapcard_share_rewards_webhook_resource_uidx
  on public.hapcard_share_rewards (webhook_resource_id)
  where webhook_resource_id is not null;
create index hapcard_share_rewards_user_date_idx
  on public.hapcard_share_rewards (user_id, reward_date_kst);

alter table public.hapcard_share_rewards enable row level security;
create policy "hapcard_share_rewards_own_read" on public.hapcard_share_rewards
  for select using (auth.uid() = user_id);
-- insert/update/delete are service_role only.

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

  if p_webhook_resource_id is not null and exists (
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

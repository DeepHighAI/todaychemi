-- Apps in Toss deviceId auxiliary mapping + device campaign talisman grants.
-- Raw deviceId values are never stored; the application server writes HMAC-SHA256 hashes only.

create table public.toss_device_connections (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  device_id_hash text not null check (device_id_hash ~ '^[a-f0-9]{64}$'),
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),

  constraint toss_device_connections_user_device_unique unique (user_id, device_id_hash)
);

create index toss_device_connections_device_hash_idx
  on public.toss_device_connections (device_id_hash);

create index toss_device_connections_user_id_idx
  on public.toss_device_connections (user_id);

alter table public.toss_device_connections enable row level security;

revoke all on public.toss_device_connections from anon;
revoke all on public.toss_device_connections from authenticated;
grant all on public.toss_device_connections to service_role;

create table public.device_campaign_talisman_grants (
  grant_id       uuid primary key default gen_random_uuid(),
  campaign_key   text not null check (campaign_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  user_id        uuid not null references public.users(user_id) on delete cascade,
  device_id_hash text not null check (device_id_hash ~ '^[a-f0-9]{64}$'),
  amount_awarded int not null check (amount_awarded > 0),
  ledger_id      uuid references public.token_ledger(ledger_id) on delete set null,
  granted_at     timestamptz not null default now(),

  constraint device_campaign_grants_campaign_user_unique unique (campaign_key, user_id),
  constraint device_campaign_grants_campaign_device_unique unique (campaign_key, device_id_hash)
);

create index device_campaign_talisman_grants_user_id_idx
  on public.device_campaign_talisman_grants (user_id);

create index device_campaign_talisman_grants_ledger_id_idx
  on public.device_campaign_talisman_grants (ledger_id);

alter table public.device_campaign_talisman_grants enable row level security;

revoke all on public.device_campaign_talisman_grants from anon;
revoke all on public.device_campaign_talisman_grants from authenticated;
grant all on public.device_campaign_talisman_grants to service_role;

create or replace function public.award_device_campaign_talisman(
  p_campaign_key text,
  p_device_id_hash text,
  p_amount int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_key text := lower(trim(p_campaign_key));
  v_device_id_hash text := lower(trim(p_device_id_hash));
  v_mapping_count int;
  v_user_id uuid;
  v_existing public.device_campaign_talisman_grants%rowtype;
  v_current_balance int;
  v_balance_after int;
  v_ledger_id uuid;
begin
  if p_campaign_key is null
     or p_device_id_hash is null
     or v_campaign_key !~ '^[a-z0-9][a-z0-9_-]{0,63}$'
     or v_device_id_hash !~ '^[a-f0-9]{64}$'
     or p_amount is null
     or p_amount <= 0 then
    return jsonb_build_object(
      'awarded', false,
      'reason', 'INVALID_INPUT',
      'amount_awarded', 0,
      'balance_after', null
    );
  end if;

  select count(*)
    into v_mapping_count
    from public.toss_device_connections
   where device_id_hash = v_device_id_hash;

  if v_mapping_count = 0 then
    return jsonb_build_object(
      'awarded', false,
      'reason', 'DEVICE_NOT_REGISTERED',
      'amount_awarded', 0,
      'balance_after', null
    );
  end if;

  if v_mapping_count > 1 then
    return jsonb_build_object(
      'awarded', false,
      'reason', 'AMBIGUOUS_DEVICE',
      'amount_awarded', 0,
      'balance_after', null
    );
  end if;

  select user_id
    into v_user_id
    from public.toss_device_connections
   where device_id_hash = v_device_id_hash
   limit 1;

  perform 1
    from public.users
   where user_id = v_user_id
   for update;

  if not found then
    return jsonb_build_object(
      'awarded', false,
      'reason', 'PROFILE_REQUIRED',
      'amount_awarded', 0,
      'balance_after', null
    );
  end if;

  select *
    into v_existing
    from public.device_campaign_talisman_grants
   where campaign_key = v_campaign_key
     and (user_id = v_user_id or device_id_hash = v_device_id_hash)
   limit 1;

  if found then
    return jsonb_build_object(
      'awarded', false,
      'reason', 'ALREADY_AWARDED',
      'amount_awarded', 0,
      'balance_after', (
        select balance_after
          from public.token_ledger
         where ledger_id = v_existing.ledger_id
      ),
      'ledger_id', v_existing.ledger_id
    );
  end if;

  select coalesce((
    select balance_after
      from public.token_ledger
     where user_id = v_user_id
     order by created_at desc
     limit 1
  ), 0)
    into v_current_balance;

  v_balance_after := v_current_balance + p_amount;

  insert into public.token_ledger (user_id, delta, reason, reference_id, balance_after)
  values (
    v_user_id,
    p_amount,
    'bonus',
    'device_campaign:' || v_campaign_key || ':' || v_device_id_hash,
    v_balance_after
  )
  returning ledger_id into v_ledger_id;

  insert into public.device_campaign_talisman_grants (
    campaign_key,
    user_id,
    device_id_hash,
    amount_awarded,
    ledger_id
  )
  values (
    v_campaign_key,
    v_user_id,
    v_device_id_hash,
    p_amount,
    v_ledger_id
  );

  return jsonb_build_object(
    'awarded', true,
    'reason', 'AWARDED',
    'amount_awarded', p_amount,
    'balance_after', v_balance_after,
    'ledger_id', v_ledger_id
  );
end;
$$;

revoke all on function public.award_device_campaign_talisman(text, text, int) from public;
revoke execute on function public.award_device_campaign_talisman(text, text, int) from anon;
revoke execute on function public.award_device_campaign_talisman(text, text, int) from authenticated;
grant execute on function public.award_device_campaign_talisman(text, text, int) to service_role;

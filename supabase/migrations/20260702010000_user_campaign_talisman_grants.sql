-- UserId-based campaign talisman grants for local operations.
-- This path does not depend on Apps in Toss deviceId hashing secrets.

create table public.user_campaign_talisman_grants (
  grant_id       uuid primary key default gen_random_uuid(),
  campaign_key   text not null check (campaign_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  user_id        uuid not null references public.users(user_id) on delete cascade,
  amount_awarded int not null check (amount_awarded > 0),
  ledger_id      uuid references public.token_ledger(ledger_id) on delete set null,
  granted_at     timestamptz not null default now(),

  constraint user_campaign_grants_campaign_user_unique unique (campaign_key, user_id)
);

create index if not exists user_campaign_talisman_grants_user_id_idx
  on public.user_campaign_talisman_grants (user_id);

create index if not exists user_campaign_talisman_grants_ledger_id_idx
  on public.user_campaign_talisman_grants (ledger_id);

alter table public.user_campaign_talisman_grants enable row level security;

revoke all on public.user_campaign_talisman_grants from anon;
revoke all on public.user_campaign_talisman_grants from authenticated;
grant all on public.user_campaign_talisman_grants to service_role;

create or replace function public.award_user_campaign_talisman(
  p_campaign_key text,
  p_user_id uuid,
  p_amount int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_key text := lower(trim(p_campaign_key));
  v_existing public.user_campaign_talisman_grants%rowtype;
  v_current_balance int;
  v_balance_after int;
  v_ledger_id uuid;
begin
  if p_campaign_key is null
     or p_user_id is null
     or v_campaign_key !~ '^[a-z0-9][a-z0-9_-]{0,63}$'
     or p_amount is null
     or p_amount <= 0 then
    return jsonb_build_object(
      'awarded', false,
      'reason', 'INVALID_INPUT',
      'amount_awarded', 0,
      'balance_after', null
    );
  end if;

  perform 1
    from public.users
   where user_id = p_user_id
   for update;

  if not found then
    return jsonb_build_object(
      'awarded', false,
      'reason', 'USER_NOT_FOUND',
      'amount_awarded', 0,
      'balance_after', null
    );
  end if;

  select *
    into v_existing
    from public.user_campaign_talisman_grants
   where campaign_key = v_campaign_key
     and user_id = p_user_id
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
     where user_id = p_user_id
     order by created_at desc
     limit 1
  ), 0)
    into v_current_balance;

  v_balance_after := v_current_balance + p_amount;

  insert into public.token_ledger (user_id, delta, reason, reference_id, balance_after)
  values (
    p_user_id,
    p_amount,
    'bonus',
    'user_campaign:' || v_campaign_key || ':' || p_user_id::text,
    v_balance_after
  )
  returning ledger_id into v_ledger_id;

  insert into public.user_campaign_talisman_grants (
    campaign_key,
    user_id,
    amount_awarded,
    ledger_id
  )
  values (
    v_campaign_key,
    p_user_id,
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

revoke all on function public.award_user_campaign_talisman(text, uuid, int) from public;
revoke execute on function public.award_user_campaign_talisman(text, uuid, int) from anon;
revoke execute on function public.award_user_campaign_talisman(text, uuid, int) from authenticated;
grant execute on function public.award_user_campaign_talisman(text, uuid, int) to service_role;

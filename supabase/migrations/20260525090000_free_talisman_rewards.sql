-- Free talisman session rewards.
-- Policy: signup +5 for new users after 2026-05-25 KST, daily authenticated app entry +1.
-- Ledger reason stays canonical 'bonus'; source is distinguished by reference_id prefixes.

create index if not exists token_ledger_user_reason_reference_idx
  on public.token_ledger (user_id, reason, reference_id);

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
  v_current_balance int;
  v_balance_after int;
  v_amount_awarded int := 0;
  v_signup_awarded boolean := false;
  v_daily_login_awarded boolean := false;
begin
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

  if p_auth_created_at is not null
     and p_auth_created_at >= p_policy_effective_at
     and not exists (
       select 1
         from public.token_ledger
        where user_id = uid
          and reason = 'bonus'
          and reference_id = v_signup_ref
     ) then
    v_balance_after := v_balance_after + 5;
    v_amount_awarded := v_amount_awarded + 5;
    v_signup_awarded := true;

    insert into public.token_ledger (user_id, delta, reason, reference_id, balance_after)
    values (uid, 5, 'bonus', v_signup_ref, v_balance_after);
  end if;

  if not exists (
    select 1
      from public.token_ledger
     where user_id = uid
       and reason = 'bonus'
       and reference_id = v_daily_ref
  ) then
    v_balance_after := v_balance_after + 1;
    v_amount_awarded := v_amount_awarded + 1;
    v_daily_login_awarded := true;

    insert into public.token_ledger (user_id, delta, reason, reference_id, balance_after)
    values (uid, 1, 'bonus', v_daily_ref, v_balance_after);
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
grant execute on function public.award_free_talisman_session_rewards(uuid, timestamptz, timestamptz) to service_role;

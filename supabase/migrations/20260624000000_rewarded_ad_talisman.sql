-- Apps in Toss rewarded ad talisman grants.
-- Policy: rewarded ad completion grants +5 talismans up to 3 times per KST day.
-- Ledger reason stays canonical 'bonus'; source is distinguished by ad_reward:<date>:<slot>.

create or replace function public.award_rewarded_ad_talisman(uid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_daily_cap int := 3;
  v_reward_amount int := 5;
  v_awarded_count int;
  v_current_balance int;
  v_balance_after int;
  v_reference_id text;
begin
  perform 1
    from public.users
   where user_id = uid
   for update;

  if not found then
    return jsonb_build_object(
      'awarded', false,
      'reason', 'PROFILE_REQUIRED',
      'amount_awarded', 0,
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

  if v_awarded_count >= v_daily_cap then
    return jsonb_build_object(
      'awarded', false,
      'reason', 'DAILY_LIMIT_REACHED',
      'amount_awarded', 0,
      'balance_after', v_current_balance,
      'remaining', 0
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
    'balance_after', v_balance_after,
    'remaining', greatest(v_daily_cap - (v_awarded_count + 1), 0)
  );
end;
$$;

revoke all on function public.award_rewarded_ad_talisman(uuid) from public;
revoke execute on function public.award_rewarded_ad_talisman(uuid) from anon;
revoke execute on function public.award_rewarded_ad_talisman(uuid) from authenticated;
grant execute on function public.award_rewarded_ad_talisman(uuid) to service_role;

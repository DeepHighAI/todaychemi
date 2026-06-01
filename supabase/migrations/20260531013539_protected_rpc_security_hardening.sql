-- Protected RPC security hardening.
-- These SECURITY DEFINER functions are server-only entry points and must not be
-- executable by browser-facing Supabase roles.

alter function public.confirm_token_purchase(uuid, text, text, text, integer, integer, text, timestamptz)
  set search_path = public;
revoke all on function public.confirm_token_purchase(uuid, text, text, text, integer, integer, text, timestamptz) from public;
revoke execute on function public.confirm_token_purchase(uuid, text, text, text, integer, integer, text, timestamptz) from anon;
revoke execute on function public.confirm_token_purchase(uuid, text, text, text, integer, integer, text, timestamptz) from authenticated;
grant execute on function public.confirm_token_purchase(uuid, text, text, text, integer, integer, text, timestamptz) to service_role;

alter function public.deduct_tokens(uuid, integer, text, text)
  set search_path = public;
revoke all on function public.deduct_tokens(uuid, integer, text, text) from public;
revoke execute on function public.deduct_tokens(uuid, integer, text, text) from anon;
revoke execute on function public.deduct_tokens(uuid, integer, text, text) from authenticated;
grant execute on function public.deduct_tokens(uuid, integer, text, text) to service_role;

alter function public.refund_tokens(uuid, integer, text, text)
  set search_path = public;
revoke all on function public.refund_tokens(uuid, integer, text, text) from public;
revoke execute on function public.refund_tokens(uuid, integer, text, text) from anon;
revoke execute on function public.refund_tokens(uuid, integer, text, text) from authenticated;
grant execute on function public.refund_tokens(uuid, integer, text, text) to service_role;

alter function public.award_free_talisman_session_rewards(uuid, timestamptz, timestamptz)
  set search_path = public;
revoke all on function public.award_free_talisman_session_rewards(uuid, timestamptz, timestamptz) from public;
revoke execute on function public.award_free_talisman_session_rewards(uuid, timestamptz, timestamptz) from anon;
revoke execute on function public.award_free_talisman_session_rewards(uuid, timestamptz, timestamptz) from authenticated;
grant execute on function public.award_free_talisman_session_rewards(uuid, timestamptz, timestamptz) to service_role;

alter function public.award_hapcard_share_reward(uuid, text, text)
  set search_path = public;
revoke all on function public.award_hapcard_share_reward(uuid, text, text) from public;
revoke execute on function public.award_hapcard_share_reward(uuid, text, text) from anon;
revoke execute on function public.award_hapcard_share_reward(uuid, text, text) from authenticated;
grant execute on function public.award_hapcard_share_reward(uuid, text, text) to service_role;

alter function public.match_classics(vector, integer, text[])
  set search_path = public;
revoke all on function public.match_classics(vector, integer, text[]) from public;
revoke execute on function public.match_classics(vector, integer, text[]) from anon;
revoke execute on function public.match_classics(vector, integer, text[]) from authenticated;
grant execute on function public.match_classics(vector, integer, text[]) to service_role;

alter function public.purge_deleted_users()
  set search_path = public;
revoke all on function public.purge_deleted_users() from public;
revoke execute on function public.purge_deleted_users() from anon;
revoke execute on function public.purge_deleted_users() from authenticated;
grant execute on function public.purge_deleted_users() to service_role;

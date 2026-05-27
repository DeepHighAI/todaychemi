import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20260525090000_free_talisman_rewards.sql'),
  'utf8',
);

describe('free talisman reward migration', () => {
  it('adds one service-role RPC for session rewards', () => {
    expect(sql).toContain('award_free_talisman_session_rewards');
    expect(sql).toContain('security definer');
    expect(sql).toContain('grant execute on function public.award_free_talisman_session_rewards');
    expect(sql).toContain('to service_role');
  });

  it('requires an onboarded public.users profile before writing token_ledger', () => {
    expect(sql).toContain('from public.users');
    expect(sql).toContain('for update');
    expect(sql).toContain('PROFILE_REQUIRED');
  });

  it('awards signup +5 only for auth users created after the KST policy start', () => {
    expect(sql).toContain("p_policy_effective_at timestamptz default '2026-05-25T00:00:00+09:00'");
    expect(sql).toContain('p_auth_created_at >= p_policy_effective_at');
    expect(sql).toContain("'signup:' || uid::text");
    expect(sql).toContain("values (uid, 5, 'bonus', v_signup_ref");
  });

  it('awards daily login +1 once per KST date', () => {
    expect(sql).toContain("now() at time zone 'Asia/Seoul'");
    expect(sql).toContain("'daily_login:' || v_today::text");
    expect(sql).toContain("values (uid, 1, 'bonus', v_daily_ref");
  });

  it('keeps free rewards under bonus reason and uses reference prefixes instead of new reasons', () => {
    expect(sql).not.toContain("'daily_login'");
    expect(sql).not.toContain("'signup_bonus'");
    expect(sql).toContain("reason = 'bonus'");
  });
});

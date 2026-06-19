import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// 항목 6/7 (§1.1 2026-06-19): 가입 보상 +5 → +50, 매일 로그인 보상 +1 → +5.
// create or replace 로 award_free_talisman_session_rewards 를 갱신한다.
const sql = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20260619000000_free_talisman_amounts.sql'),
  'utf8',
);

describe('free talisman amounts migration (signup +50 / daily +5)', () => {
  it('replaces the existing service-role RPC (이름·시그니처 동일)', () => {
    expect(sql).toContain('create or replace function public.award_free_talisman_session_rewards');
    expect(sql).toContain('security definer');
    expect(sql).toContain('grant execute on function public.award_free_talisman_session_rewards');
    expect(sql).toContain('to service_role');
  });

  it('awards signup +50 with the same signup reference + KST policy gate', () => {
    expect(sql).toContain("p_auth_created_at >= p_policy_effective_at");
    expect(sql).toContain("'signup:' || uid::text");
    expect(sql).toContain("values (uid, 50, 'bonus', v_signup_ref");
    expect(sql).not.toContain("values (uid, 5, 'bonus', v_signup_ref");
  });

  it('awards daily login +5 once per KST date', () => {
    expect(sql).toContain("now() at time zone 'Asia/Seoul'");
    expect(sql).toContain("'daily_login:' || v_today::text");
    expect(sql).toContain("values (uid, 5, 'bonus', v_daily_ref");
    expect(sql).not.toContain("values (uid, 1, 'bonus', v_daily_ref");
  });

  it('keeps the canonical bonus reason and reference-prefix idempotency', () => {
    expect(sql).toContain("reason = 'bonus'");
    expect(sql).not.toContain("'signup_bonus'");
    expect(sql).not.toContain("'daily_login_bonus'");
  });
});

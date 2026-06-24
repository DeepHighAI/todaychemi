import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20260624020000_reward_policy_settings.sql'),
  'utf8',
);
const lower = sql.toLowerCase();

describe('reward policy settings migration', () => {
  it('adds a server-controlled reward policy table with the approved default amounts', () => {
    expect(lower).toContain('create table public.reward_policy_settings');
    expect(sql).toContain("reward_key in ('signup', 'daily_login', 'rewarded_ad', 'kakao_share')");
    expect(sql).toContain("('signup', 100, null, true");
    expect(sql).toContain("('daily_login', 10, 1, true");
    expect(sql).toContain("('rewarded_ad', 10, 3, true");
    expect(sql).toContain("('kakao_share', 11, 5, true");
  });

  it('keeps policy settings server-operable but closed to public clients', () => {
    expect(lower).toContain('alter table public.reward_policy_settings enable row level security');
    expect(lower).toContain('revoke all on public.reward_policy_settings from anon');
    expect(lower).toContain('revoke all on public.reward_policy_settings from authenticated');
    expect(lower).toContain('grant all on public.reward_policy_settings to service_role');
  });

  it('rewrites session rewards to read signup/daily amounts from reward_policy_settings', () => {
    expect(sql).toContain("where reward_key = 'signup'");
    expect(sql).toContain("where reward_key = 'daily_login'");
    expect(sql).toContain("values (uid, v_signup_amount, 'bonus', v_signup_ref");
    expect(sql).toContain("values (uid, v_daily_amount, 'bonus', v_daily_ref");
    expect(sql).toContain("'signup:' || uid::text");
    expect(sql).toContain("'daily_login:' || v_today::text");
  });

  it('rewrites rewarded ad rewards to read amount and daily cap from reward_policy_settings', () => {
    expect(sql).toContain("where reward_key = 'rewarded_ad'");
    expect(sql).toContain('v_daily_cap int := 0');
    expect(sql).toContain('v_reward_amount int := 0');
    expect(sql).toContain("values (uid, v_reward_amount, 'bonus', v_reference_id");
    expect(sql).toContain("'ad_reward:' || v_today::text || ':'");
    expect(sql).toContain("'DAILY_LIMIT_REACHED'");
  });

  it('rewrites Kakao share rewards to read amount and daily cap from reward_policy_settings', () => {
    expect(sql).toContain("where reward_key = 'kakao_share'");
    expect(sql).toContain('v_daily_count >= v_daily_cap');
    expect(sql).toContain("values (v_share.user_id, v_reward_amount, 'bonus', 'share:'");
    expect(sql).toContain('where user_id = v_share.user_id');
    expect(sql).toContain('and hapcard_id = v_share.hapcard_id');
    expect(sql).toContain('WEBHOOK_REQUIRED');
  });
});

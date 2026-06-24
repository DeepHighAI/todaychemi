import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20260624000000_rewarded_ad_talisman.sql'),
  'utf8',
);

describe('rewarded ad talisman migration', () => {
  it('adds one service-role RPC for rewarded ad grants', () => {
    expect(sql).toContain('create or replace function public.award_rewarded_ad_talisman');
    expect(sql).toContain('security definer');
    expect(sql).toContain('grant execute on function public.award_rewarded_ad_talisman');
    expect(sql).toContain('to service_role');
    expect(sql).toContain('revoke execute on function public.award_rewarded_ad_talisman(uuid) from authenticated');
  });

  it('locks the public user row before counting and writing rewards', () => {
    expect(sql).toContain('from public.users');
    expect(sql).toContain('where user_id = uid');
    expect(sql).toContain('for update');
  });

  it('grants +5 bonus talismans up to 3 times per KST date', () => {
    expect(sql).toContain("now() at time zone 'Asia/Seoul'");
    expect(sql).toContain('v_daily_cap int := 3');
    expect(sql).toContain('v_reward_amount int := 5');
    expect(sql).toContain("values (uid, v_reward_amount, 'bonus', v_reference_id");
    expect(sql).toContain("'DAILY_LIMIT_REACHED'");
  });

  it('keeps source tracking in ad_reward reference ids without adding a new ledger reason', () => {
    expect(sql).toContain("'ad_reward:' || v_today::text || ':'");
    expect(sql).toContain("reason = 'bonus'");
    expect(sql).not.toContain("'ad_reward'");
    expect(sql).not.toContain("'rewarded_ad'");
  });
});

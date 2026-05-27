import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20260524090000_hapcard_shares.sql'),
  'utf8',
);

describe('hapcard share reward migration', () => {
  it('stores only token_hash and does not persist raw public token URL columns', () => {
    expect(sql).toContain('token_hash');
    expect(sql).not.toMatch(/\n\s+token\s+text/i);
    expect(sql).not.toMatch(/\n\s+url\s+text/i);
    expect(sql).not.toMatch(/\n\s+og_image_url\s+text/i);
  });

  it('enforces hapcard당 1회 보상 and KST daily cap 5', () => {
    expect(sql).toContain('unique (user_id, hapcard_id)');
    expect(sql).toContain("now() at time zone 'Asia/Seoul'");
    expect(sql).toContain('v_daily_count >= 5');
  });

  it('writes bonus +1 ledger entry with share reference id', () => {
    expect(sql).toContain("'bonus'");
    expect(sql).toContain("'share:' || v_share.share_id::text");
    expect(sql).toContain('v_balance_after := v_previous_balance + 1');
  });

  it('deduplicates Kakao webhooks by webhook_resource_id', () => {
    expect(sql).toContain('hapcard_share_rewards_webhook_resource_uidx');
    expect(sql).toContain('DUPLICATE_WEBHOOK');
  });

  it('allows rewards only for Kakao webhook-confirmed shares', () => {
    expect(sql).toContain("channel             text not null check (channel in ('kakao'))");
    expect(sql).toContain("p_channel <> 'kakao'");
    expect(sql).toContain('WEBHOOK_REQUIRED');
    expect(sql).toContain('v_share.channel <> p_channel');
    expect(sql).toContain('CHANNEL_MISMATCH');
  });
});

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const SQL = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20260702010000_user_campaign_talisman_grants.sql'),
  'utf8',
);
const LOWER = SQL.toLowerCase();

describe('user campaign talisman grants migration', () => {
  it('adds a service-role user campaign grant table', () => {
    expect(LOWER).toContain('create table public.user_campaign_talisman_grants');
    expect(SQL).toContain('user_campaign_grants_campaign_user_unique unique (campaign_key, user_id)');
    expect(LOWER).toContain('alter table public.user_campaign_talisman_grants enable row level security');
    expect(LOWER).toContain('revoke all on public.user_campaign_talisman_grants from authenticated');
    expect(LOWER).toContain('grant all on public.user_campaign_talisman_grants to service_role');
  });

  it('adds a protected idempotent user campaign reward RPC', () => {
    expect(LOWER).toContain('create or replace function public.award_user_campaign_talisman');
    expect(LOWER).toContain('security definer');
    expect(LOWER).toContain('set search_path = public');
    expect(SQL).toContain('USER_NOT_FOUND');
    expect(SQL).toContain('ALREADY_AWARDED');
    expect(SQL).toContain("'user_campaign:' || v_campaign_key || ':' || p_user_id::text");
    expect(SQL).toContain("'bonus'");
    expect(LOWER).toContain('revoke execute on function public.award_user_campaign_talisman(text, uuid, int) from authenticated');
    expect(LOWER).toContain('grant execute on function public.award_user_campaign_talisman(text, uuid, int) to service_role');
  });
});

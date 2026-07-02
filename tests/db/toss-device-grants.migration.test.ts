import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const SQL = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20260702000000_toss_device_grants.sql'),
  'utf8',
);
const LOWER = SQL.toLowerCase();

describe('toss device grants migration', () => {
  it('stores only hashed device identifiers in a service-role table', () => {
    expect(LOWER).toContain('create table public.toss_device_connections');
    expect(SQL).toContain('device_id_hash');
    expect(SQL).toContain("device_id_hash ~ '^[a-f0-9]{64}$'");
    expect(LOWER).not.toMatch(/\bdevice_id\s+text\b/);
    expect(LOWER).toContain('alter table public.toss_device_connections enable row level security');
    expect(LOWER).toContain('revoke all on public.toss_device_connections from authenticated');
    expect(LOWER).toContain('grant all on public.toss_device_connections to service_role');
  });

  it('adds campaign grant uniqueness by user and by device hash', () => {
    expect(LOWER).toContain('create table public.device_campaign_talisman_grants');
    expect(SQL).toContain('device_campaign_grants_campaign_user_unique unique (campaign_key, user_id)');
    expect(SQL).toContain('device_campaign_grants_campaign_device_unique unique (campaign_key, device_id_hash)');
    expect(LOWER).toContain('alter table public.device_campaign_talisman_grants enable row level security');
    expect(LOWER).toContain('grant all on public.device_campaign_talisman_grants to service_role');
  });

  it('adds a protected idempotent device campaign reward RPC', () => {
    expect(LOWER).toContain('create or replace function public.award_device_campaign_talisman');
    expect(LOWER).toContain('security definer');
    expect(LOWER).toContain('set search_path = public');
    expect(SQL).toContain('DEVICE_NOT_REGISTERED');
    expect(SQL).toContain('AMBIGUOUS_DEVICE');
    expect(SQL).toContain('ALREADY_AWARDED');
    expect(SQL).toContain("'device_campaign:' || v_campaign_key || ':' || v_device_id_hash");
    expect(SQL).toContain("values (");
    expect(SQL).toContain("'bonus'");
    expect(LOWER).toContain('revoke execute on function public.award_device_campaign_talisman(text, text, int) from authenticated');
    expect(LOWER).toContain('grant execute on function public.award_device_campaign_talisman(text, text, int) to service_role');
  });
});

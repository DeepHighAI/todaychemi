import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const MIGRATION = readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260525103000_legal_consent_privacy_version.sql'),
  'utf8',
);
const USERS_BASE = readFileSync(
  path.join(process.cwd(), 'supabase/migrations/0002_users.sql'),
  'utf8',
);
const LEGAL_CONSENTS = readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260525110000_legal_consents.sql'),
  'utf8',
);
const GUEST_LEGAL_CONSENTS = readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260526010000_guest_legal_consents.sql'),
  'utf8',
);

describe('legal consent migration contract', () => {
  it('adds separated privacy consent version to users', () => {
    expect(MIGRATION).toContain('add column if not exists consented_privacy_version text');
    expect(MIGRATION).toContain('set consented_privacy_version = consented_tos_version');
    expect(MIGRATION).toContain('alter column consented_privacy_version set not null');
  });

  it('keeps fresh database schema aligned with the live migration', () => {
    expect(USERS_BASE).toContain('consented_tos_version text');
    expect(USERS_BASE).toContain('consented_privacy_version text');
    expect(USERS_BASE).toContain('age_confirmed    boolean');
  });

  it('stores legal consent evidence server-side without raw nonce tokens', () => {
    expect(LEGAL_CONSENTS).toContain('create table public.legal_consents');
    expect(LEGAL_CONSENTS).toContain('token_hash      text not null unique');
    expect(LEGAL_CONSENTS).not.toMatch(/\n\s+token\s+text/i);
    expect(LEGAL_CONSENTS).toContain("flow in ('email', 'oauth')");
    expect(LEGAL_CONSENTS).toContain("provider in ('google', 'kakao')");
    expect(LEGAL_CONSENTS).toContain('enable row level security');
  });

  it('adds guest legal consent flow without a provider', () => {
    expect(GUEST_LEGAL_CONSENTS).toContain("flow in ('email', 'oauth', 'guest')");
    expect(GUEST_LEGAL_CONSENTS).toContain("flow in ('email', 'guest') and provider is null");
  });
});

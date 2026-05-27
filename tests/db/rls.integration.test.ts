/**
 * C-7 RLS 통합 테스트 — 라이브 Supabase 대상.
 * NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SUPABASE_SERVICE_ROLE_KEY 없으면 suite skip.
 * PostgREST + RLS 동작:
 *   - owner-only: anon SELECT → 0 rows (에러 아님, 필터링됨)
 *   - public-read: anon SELECT → 0 rows OK (데이터 없음), anon INSERT → error
 *   - service-role-only(정책 0): anon SELECT → 0 rows, anon INSERT → error
 *   - service_role: RLS 우회 → SELECT 에러 없음
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { MIGRATIONS_MANIFEST, type TableSpec } from './migrations.manifest';

// ── env 가드 ──────────────────────────────────────────────────────────────────
const hasEnv =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

// ── 테이블 분류 ───────────────────────────────────────────────────────────────
const tableMigrations = MIGRATIONS_MANIFEST.filter((s): s is TableSpec => s.kind === 'table');

const OWNER_ONLY_TABLES = tableMigrations
  .filter((s) => s.rls.policies.length > 0 && !s.rls.policies.some((p) => p.includes('public_read')))
  .map((s) => s.tableName);

const PUBLIC_READ_TABLES = tableMigrations
  .filter((s) => s.rls.policies.some((p) => p.includes('public_read')))
  .map((s) => s.tableName);

const SERVICE_ROLE_ONLY_TABLES = tableMigrations
  .filter((s) => s.rls.enabled && s.rls.policies.length === 0)
  .map((s) => s.tableName);

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────
function fetchWithTimeout(timeoutMs: number = 5000): typeof fetch {
  return async (input, init = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, { ...init, signal: init.signal ?? controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  };
}

async function expectAnonDenied(anon: SupabaseClient, table: string) {
  const { data, error } = await anon.from(table).select('*').limit(5);
  // PostgREST: RLS 필터링 → 0 rows, error null
  expect(error, `${table} anon SELECT: 예상치 못한 에러`).toBeNull();
  expect(data?.length ?? -1, `${table} anon SELECT: 0 rows 기대`).toBe(0);
}

async function expectServiceRoleAccess(svc: SupabaseClient, table: string) {
  const { error } = await svc.from(table).select('*', { count: 'exact', head: true });
  expect(error, `${table} service_role SELECT: 에러 없어야 함`).toBeNull();
}

// ── 메인 suite ────────────────────────────────────────────────────────────────
describe.skipIf(!hasEnv)('C-7 RLS 통합 테스트', () => {
  let anon: SupabaseClient;
  let svc: SupabaseClient;

  beforeAll(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const global = { fetch: fetchWithTimeout() };
    anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false }, global });
    svc = createClient(url, svcKey, { auth: { persistSession: false, autoRefreshToken: false }, global });
  });

  // ── A. Owner-only: anon SELECT 0 rows ──────────────────────────────────────
  describe('A. Owner-only 테이블: anon SELECT 차단', () => {
    for (const table of OWNER_ONLY_TABLES) {
      it(`${table}: anon SELECT → 0 rows`, async () => {
        await expectAnonDenied(anon, table);
      });
    }
  });

  // ── B. Public-read: anon SELECT OK, anon INSERT 차단 ─────────────────────
  describe('B. Public-read 테이블: anon SELECT 허용 / INSERT 차단', () => {
    for (const table of PUBLIC_READ_TABLES) {
      it(`${table}: anon SELECT → no error`, async () => {
        const { error } = await anon.from(table).select('*').limit(5);
        expect(error, `${table} anon SELECT 에러 없어야 함`).toBeNull();
      });
    }

    it('prompt_versions: anon INSERT → RLS error', async () => {
      const { error } = await anon.from('prompt_versions').insert({
        prompt_name: '__rls_test__',
        version: '0',
        content: 'test',
        status: 'active',
      });
      expect(error, 'anon INSERT는 RLS error 여야 함').not.toBeNull();
    });

    it('knowledge_assets: anon INSERT → RLS error', async () => {
      const { error } = await anon.from('knowledge_assets').insert({
        asset_id: '__rls_test__',
        asset_type: 'classic',
        content: '{}',
        version: '0',
        review_status: 'draft',
      });
      expect(error, 'anon INSERT는 RLS error 여야 함').not.toBeNull();
    });
  });

  // ── C. Service-role-only: anon 완전 차단 ──────────────────────────────────
  describe('C. Service-role-only 테이블: anon 완전 차단', () => {
    for (const table of SERVICE_ROLE_ONLY_TABLES) {
      it(`${table}: anon SELECT → 0 rows`, async () => {
        await expectAnonDenied(anon, table);
      });
    }

    it('banned_phrase_hits: anon INSERT → RLS error', async () => {
      const { error } = await anon.from('banned_phrase_hits').insert({
        prompt_version: '__rls_test__',
        phrase_category: 'test',
        phrase_matched: 'test',
      });
      expect(error, 'anon INSERT는 RLS error 여야 함').not.toBeNull();
    });
  });

  // ── D. service_role bypass: 18 테이블 모두 접근 가능 ──────────────────────
  describe('D. service_role bypass: 모든 테이블 SELECT 권한 통과', () => {
    for (const table of tableMigrations.map((s) => s.tableName)) {
      it(`${table}: service_role SELECT → no error`, async () => {
        await expectServiceRoleAccess(svc, table);
      });
    }
  });
});

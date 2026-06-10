import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SQL = fs.readFileSync(
  path.resolve(
    process.cwd(),
    'supabase/migrations/20260610000000_relation_slot_registration.sql',
  ),
  'utf8',
);
const LOWER = SQL.toLowerCase();

describe('relation slot registration migration (ADR-039 Amended)', () => {
  it('pending_relation_registrations 스테이징 테이블을 만든다 (owner RLS)', () => {
    expect(LOWER).toContain('create table public.pending_relation_registrations');
    for (const col of [
      'pending_id',
      'user_id',
      'draft',
      'relation_id',
      'materialized_at',
      'created_at',
    ]) {
      expect(SQL, `컬럼 ${col} 누락`).toContain(col);
    }
    expect(LOWER).toContain('enable row level security');
    expect(SQL).toContain('"pending_relation_registrations_own"');
    // 쓰기는 service-role 전용 — 클라이언트가 멱등 마커(materialized_at)를 변조 못 하게 SELECT 전용
    expect(LOWER).toContain('for select');
    expect(LOWER).not.toContain('for all');
    // relations 삭제 시 FK set-null 스캔용 인덱스
    expect(SQL).toContain('pending_relation_registrations_relation_id_idx');
  });

  it('구 feature_id CHECK 이름 드리프트를 적용 시점에 터뜨리는 가드를 포함한다', () => {
    expect(LOWER).toContain('stale narrow payments feature_id check');
  });

  it('payments.feature_id CHECK 를 relation_slot 포함으로 재생성한다', () => {
    expect(LOWER).toContain('drop constraint if exists payments_feature_id_check');
    expect(SQL).toContain(
      "feature_id in ('hapcard', 'whatif', 'replay', 'relation_slot')",
    );
  });

  it('token_ledger 멱등 부분 유니크 인덱스 2개를 relation_slot reason 포함으로 재생성한다', () => {
    expect(LOWER).toContain(
      'drop index if exists public.token_ledger_feature_spend_reference_uidx',
    );
    expect(LOWER).toContain(
      'drop index if exists public.token_ledger_feature_refund_reference_uidx',
    );
    expect(SQL).toContain(
      "reason in ('hapcard_use', 'replay_use', 'whatif_use', 'relation_slot_use')",
    );
    expect(SQL).toContain(
      "reason in ('hapcard_refund', 'replay_refund', 'whatif_refund', 'relation_slot_refund')",
    );
  });

  it('deduct/refund_tokens_once 본문 IN-list 에도 relation_slot reason 이 들어간다 (더블탭 멱등 하드 게이트)', () => {
    expect(LOWER).toContain('create or replace function public.deduct_tokens_once');
    expect(LOWER).toContain('create or replace function public.refund_tokens_once');
    // 인덱스 predicate 1회 + 함수 본문 사전 멱등 체크 1회 = 최소 2회씩 등장해야 한다.
    // 함수 IN-list 누락 시 재시도마다 새 차감 row 가 쌓이는 이중과금이 된다.
    expect(SQL.match(/'relation_slot_use'/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(SQL.match(/'relation_slot_refund'/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('RPC 는 service_role 전용 grant 를 재선언한다', () => {
    expect(LOWER).toContain(
      'grant execute on function public.deduct_tokens_once(uuid, integer, text, text) to service_role',
    );
    expect(LOWER).toContain(
      'grant execute on function public.refund_tokens_once(uuid, integer, text, text) to service_role',
    );
    expect(LOWER).toContain(
      'revoke all on function public.deduct_tokens_once(uuid, integer, text, text) from public',
    );
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SQL = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20260610120000_pending_draft_purge.sql'),
  'utf8',
);
const LOWER = SQL.toLowerCase();

describe('pending draft PII purge migration (ADR-039 §9 후속, §1.1 2026-06-10)', () => {
  it('purge 함수 + 일일 cron 을 등록한다', () => {
    expect(LOWER).toContain(
      'create or replace function public.purge_pending_relation_drafts',
    );
    expect(LOWER).toContain('cron.schedule');
    expect(SQL).toContain("'purge-pending-relation-drafts'");
  });

  it('삭제는 미머티리얼라이즈 + 30일 경과 행만 — paid 고아(pending/confirmed 결제)는 절대 보호', () => {
    expect(LOWER).toContain('materialized_at is null');
    expect(LOWER).toContain("interval '30 days'");
    // 결제 흔적이 pending/confirmed 면 NOT EXISTS 로 삭제 대상에서 제외 (lazy recovery 보존)
    expect(LOWER).toContain('not exists');
    expect(LOWER).toContain("pay.status in ('pending', 'confirmed')");
    expect(LOWER).toContain("'relation_slot:' || p.pending_id::text");
  });

  it('스크럽은 전달완료/소비 행의 draft 만 7일 후 비운다 — 멱등 마커는 유지', () => {
    expect(LOWER).toContain("interval '7 days'");
    expect(LOWER).toContain("set draft = '{}'::jsonb");
    // 삭제로 소비(relation_id null) 또는 전달 완료(relations 행 존재)만 스크럽
    expect(LOWER).toContain('p.relation_id is null');
    expect(LOWER).toContain('exists (select 1 from public.relations r');
    // 크래시-복구 창(relation_id 有 + relations 행 부재)은 재INSERT 에 draft 필요 — 보존 주석
    expect(SQL).toContain('크래시');
    // materialized_at/relation_id 를 건드리지 않는다 (set 절은 draft 단일)
    expect(LOWER).not.toContain('set materialized_at');
    expect(LOWER).not.toContain('set relation_id');
  });
});

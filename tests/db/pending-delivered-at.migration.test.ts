import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SQL = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20260610130000_pending_delivered_at.sql'),
  'utf8',
);
const LOWER = SQL.toLowerCase();

describe('pending delivered_at migration (relation_slot FK fix, /qa 2026-06-10)', () => {
  it('pending_relation_registrations 에 delivered_at 컬럼을 additive 로 추가한다', () => {
    expect(LOWER).toContain('add column if not exists delivered_at timestamptz');
  });

  it('기존 전달된(relation_id 살아있는) 행을 delivered 로 백필한다', () => {
    expect(LOWER).toContain('update public.pending_relation_registrations');
    expect(LOWER).toContain('set delivered_at');
    expect(LOWER).toContain('relation_id is not null');
  });

  it('purge 함수를 delivered_at 기준으로 재작성한다 (미전달 = delivered_at IS NULL)', () => {
    expect(LOWER).toContain('create or replace function public.purge_pending_relation_drafts');
    // 삭제 대상 = 미전달(delivered_at IS NULL) + 30일 + 미결제. materialized_at 이 아니라 delivered_at.
    expect(LOWER).toContain('delivered_at is null');
    expect(LOWER).toContain("interval '30 days'");
    expect(LOWER).toContain("pay.status in ('pending', 'confirmed')");
    // 스크럽 대상 = 전달완료/소비(delivered_at IS NOT NULL) + 7일
    expect(LOWER).toContain('delivered_at is not null');
    expect(LOWER).toContain("interval '7 days'");
    expect(LOWER).toContain("set draft = '{}'::jsonb");
  });

  it('cron 은 재등록하지 않는다 (이미 20260610120000 에서 스케줄됨, 함수만 replace)', () => {
    expect(LOWER).not.toContain('cron.schedule');
  });
});

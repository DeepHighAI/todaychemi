import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SQL = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20260613000100_fk_index_coverage.sql'),
  'utf8',
);
const LOWER = SQL.toLowerCase();

describe('FK index coverage migration (T6c #5, P1-04, §1.1 2026-06-13)', () => {
  it('hapcard_shares.relation_id 인덱스를 추가한다', () => {
    expect(LOWER).toMatch(/on public\.hapcard_shares\s*\(relation_id\)/);
  });

  it('hapcard_share_rewards.hapcard_id 인덱스를 추가한다', () => {
    expect(LOWER).toMatch(/on public\.hapcard_share_rewards\s*\(hapcard_id\)/);
  });

  it('hapcard_share_rewards.ledger_id 인덱스를 추가한다', () => {
    expect(LOWER).toMatch(/on public\.hapcard_share_rewards\s*\(ledger_id\)/);
  });

  it('daily_haps.primary_relation_id 인덱스를 추가한다', () => {
    expect(LOWER).toMatch(/on public\.daily_haps\s*\(primary_relation_id\)/);
  });

  it('4개 인덱스를 idempotent(create index if not exists)로 추가한다', () => {
    const count = (LOWER.match(/create index if not exists/g) || []).length;
    expect(count).toBe(4);
  });

  it('테이블/정책을 새로 만들지 않는다 (인덱스만 추가)', () => {
    expect(LOWER).not.toContain('create table');
    expect(LOWER).not.toContain('create policy');
  });
});

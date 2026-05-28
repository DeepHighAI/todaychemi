import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// G2 / Phase 3 F1.1 — daily_haps에 인연 종합 컬럼 2건 추가 + llm_model default 격상
const FILE = path.resolve(
  process.cwd(),
  'supabase/migrations/0029_daily_haps_g2_columns.sql',
);

describe('0029_daily_haps_g2_columns.sql — DDL 계약', () => {
  it('파일이 존재한다', () => {
    expect(fs.existsSync(FILE)).toBe(true);
  });

  it('relation_nickname text null 컬럼 추가', () => {
    const sql = fs.readFileSync(FILE, 'utf-8').toLowerCase();
    expect(sql).toContain('add column');
    expect(sql).toContain('relation_nickname');
  });

  it('today_compat_score smallint null + check (0..100) 컬럼 추가', () => {
    const sql = fs.readFileSync(FILE, 'utf-8').toLowerCase();
    expect(sql).toContain('today_compat_score');
    expect(sql).toContain('smallint');
    expect(sql).toMatch(/today_compat_score\s+(?:smallint\s+)?(?:null\s+)?check\s*\(\s*today_compat_score\s+between\s+0\s+and\s+100/);
  });

  it("llm_model default 'gpt-5-mini' → 'gpt-5' 변경", () => {
    const sql = fs.readFileSync(FILE, 'utf-8');
    // alter column llm_model set default 'gpt-5'
    expect(sql).toMatch(/alter\s+(table\s+)?(public\.)?daily_haps\s+alter\s+column\s+llm_model\s+set\s+default\s+'gpt-5'/i);
  });

  it('daily_haps 테이블만 수정 (다른 테이블 변경 금지)', () => {
    const sql = fs.readFileSync(FILE, 'utf-8').toLowerCase();
    // alter table 다른 테이블이 있으면 안 됨 — daily_haps 만 허용
    const otherTables = sql.match(/alter\s+table\s+(?:public\.)?(\w+)/g) ?? [];
    for (const m of otherTables) {
      expect(m).toMatch(/daily_haps/);
    }
  });
});

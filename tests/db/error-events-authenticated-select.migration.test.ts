import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SQL = fs.readFileSync(
  path.resolve(
    process.cwd(),
    'supabase/migrations/20260613000000_error_events_authenticated_select.sql',
  ),
  'utf8',
);
const LOWER = SQL.toLowerCase();

describe('error_events authenticated SELECT RLS migration (T6c #2, §1.1 2026-06-13)', () => {
  it('본인 trace owner-scope SELECT 정책을 추가한다', () => {
    expect(SQL).toContain('"error_events authenticated select own"');
    expect(LOWER).toContain('on public.error_events');
    expect(LOWER).toContain('for select');
    expect(LOWER).toContain('to authenticated');
    expect(LOWER).toContain('using (user_id = auth.uid())');
  });

  it('테이블/컬럼을 새로 만들지 않는다 (정책만 추가)', () => {
    expect(LOWER).not.toContain('create table');
    expect(LOWER).not.toContain('alter table');
  });

  it('읽기 전용 노출 — INSERT/UPDATE/DELETE/ALL 권한은 부여하지 않는다', () => {
    expect(LOWER).not.toContain('for insert');
    expect(LOWER).not.toContain('for update');
    expect(LOWER).not.toContain('for delete');
    expect(LOWER).not.toContain('for all');
  });
});

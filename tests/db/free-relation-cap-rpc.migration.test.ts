import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SQL = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20260610140000_free_relation_cap_rpc.sql'),
  'utf8',
);
const LOWER = SQL.toLowerCase();

describe('free relation cap RPC migration (TOCTOU 차단, /qa 2026-06-10)', () => {
  it('insert_relation_if_under_free_cap RPC 를 만든다 (security definer)', () => {
    expect(LOWER).toContain(
      'create or replace function public.insert_relation_if_under_free_cap',
    );
    expect(LOWER).toContain('security definer');
    expect(LOWER).toContain('set search_path = public');
  });

  it('count 와 INSERT 를 단일 INSERT...SELECT...WHERE 로 원자 결합한다 (TOCTOU 제거)', () => {
    expect(LOWER).toContain('insert into public.relations');
    // count 가드가 WHERE 절에 — 별도 SELECT 후 INSERT(2-step)가 아니라 단일문
    expect(LOWER).toContain('select count(*) from public.relations');
    expect(LOWER).toContain('where (select count(*) from public.relations where user_id');
    expect(LOWER).toContain('< p_free_slots');
    expect(LOWER).toContain('returning relation_id');
  });

  it('draft jsonb 의 모든 relations 컬럼을 타입 캐스트로 매핑한다', () => {
    for (const col of ['nickname', 'mode', 'gender', 'birth_date', 'birth_date_calendar', 'is_lunar_leap', 'birth_time_knowledge', 'birth_time', 'birth_longitude', 'consent_confirmed', 'is_primary']) {
      expect(SQL, `draft->>'${col}' 매핑 누락`).toContain(`'${col}'`);
    }
    expect(LOWER).toContain('::date');
    expect(LOWER).toContain('::time');
    expect(LOWER).toContain('::numeric');
    expect(LOWER).toContain('::boolean');
  });

  it('service_role 전용 grant 를 재선언한다 (user_id 는 호출부가 인증값으로 전달)', () => {
    expect(LOWER).toContain('revoke all on function public.insert_relation_if_under_free_cap');
    expect(LOWER).toContain('to service_role');
  });
});

-- 무료 인연 슬롯 TOCTOU 차단 (ADR-039 §9 수용①→차단, /qa 2026-06-10).
-- 기존 무료 경로는 `count(relations) < 2` SELECT 후 별도 INSERT 의 2-step 이라
-- 동시 요청이 둘 다 count<2 를 통과해 무료 슬롯을 초과 등록할 수 있었다(TOCTOU).
--
-- count 와 INSERT 를 단일 `INSERT ... SELECT ... WHERE count < N` 문으로 원자 결합한다.
-- 같은 user_id 에 대한 동시 INSERT 는 row-level 직렬화로 정확히 한도까지만 통과 → 우회 차단.
-- 0행 반환(WHERE false) = 슬롯 초과 → 호출부가 유료 경로로 분기.
--
-- draft 는 Zod 검증을 통과한 RelationCreate jsonb. chart compute(KASI 외부 호출)는
-- 이 RPC 밖에서 best-effort 로 수행한다(relation 등록과 분리, chartPending UX 유지).
-- security definer + p_user_id 파라미터 — 호출부(POST /api/relations)가 인증된 user.id 를 전달.

create or replace function public.insert_relation_if_under_free_cap(
  p_user_id uuid,
  p_draft jsonb,
  p_free_slots int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.relations (
    user_id, nickname, mode, gender, birth_date, birth_date_calendar,
    is_lunar_leap, birth_time_knowledge, birth_time, birth_longitude,
    consent_confirmed, is_primary
  )
  select
    p_user_id,
    p_draft->>'nickname',
    p_draft->>'mode',
    p_draft->>'gender',
    (p_draft->>'birth_date')::date,
    p_draft->>'birth_date_calendar',
    (p_draft->>'is_lunar_leap')::boolean,
    p_draft->>'birth_time_knowledge',
    nullif(p_draft->>'birth_time', '')::time,
    (p_draft->>'birth_longitude')::numeric,
    (p_draft->>'consent_confirmed')::boolean,
    coalesce((p_draft->>'is_primary')::boolean, false)
  where (select count(*) from public.relations where user_id = p_user_id) < p_free_slots
  returning relation_id into new_id;

  return new_id; -- null = 무료 슬롯 초과 (WHERE false → 0행)
end $$;

revoke all on function public.insert_relation_if_under_free_cap(uuid, jsonb, int) from public;
revoke execute on function public.insert_relation_if_under_free_cap(uuid, jsonb, int) from anon;
revoke execute on function public.insert_relation_if_under_free_cap(uuid, jsonb, int) from authenticated;
grant execute on function public.insert_relation_if_under_free_cap(uuid, jsonb, int) to service_role;

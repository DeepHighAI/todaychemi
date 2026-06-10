-- Pending draft PII purge (ADR-039 §9 수용 ③ 후속 — §1.1 확정 2026-06-10).
-- pending_relation_registrations.draft 는 인연 PII(별명·생년월일·성별·출생시각)를 담는다.
-- 결제 이탈 draft 의 무기한 보관을 끊는다 (ADR-004/011 PII 최소화):
--   1) 삭제: 미머티리얼라이즈 + 30일 경과 + 결제가 pending/confirmed 가 아닌 행.
--      confirmed = paid 고아(lazy recovery 대상) — 절대 삭제 금지. pending = 진행 중 보호.
--   2) 스크럽: 전달 완료(relations 행 존재) 또는 삭제로 소비(relation_id NULL)된 행은
--      7일 후 draft 만 '{}' 로 비운다. 멱등 마커(materialized_at·relation_id)는 유지해
--      confirm 재진입 소유 검증·단락이 계속 동작한다.
--      크래시-복구 창(relation_id 有 + relations 행 부재)은 재INSERT 에 draft 가 필요해 보존.

create or replace function public.purge_pending_relation_drafts()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1) 미결제·미머티리얼라이즈 30일 경과 행 삭제 (paid 고아 보호)
  delete from public.pending_relation_registrations p
   where p.materialized_at is null
     and p.created_at < now() - interval '30 days'
     and not exists (
       select 1
         from public.payments pay
        where pay.charge_type = 'feature_use'
          and pay.feature_id = 'relation_slot'
          and pay.feature_ref = 'relation_slot:' || p.pending_id::text
          and pay.status in ('pending', 'confirmed')
     );

  -- 2) 전달 완료/소비 행의 draft 스크럽 (7일 후, draft 단일 컬럼만)
  update public.pending_relation_registrations p
     set draft = '{}'::jsonb
   where p.materialized_at is not null
     and p.materialized_at < now() - interval '7 days'
     and p.draft <> '{}'::jsonb
     and (
       p.relation_id is null
       or exists (select 1 from public.relations r where r.relation_id = p.relation_id)
     );
end $$;

select cron.schedule(
  'purge-pending-relation-drafts',
  '20 4 * * *',
  $$select public.purge_pending_relation_drafts()$$
);

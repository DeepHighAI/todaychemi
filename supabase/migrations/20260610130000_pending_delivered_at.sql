-- relation_slot materialize FK 충돌 수정 (P0, /qa 2026-06-10).
-- 기존 claim-first 는 relations INSERT 전에 relation_id=newId 를 기록하려다
-- FK(relation_id → relations on delete set null) 위반(23503)으로 인연 등록이 100% 실패했다.
--
-- delivered_at 마커를 도입해 상태를 분리한다:
--   materialized_at — 클레임됨(전달 시도 진입). relation_id 는 건드리지 않는다.
--   delivered_at    — relations INSERT 완료. 이때 relation_id 를 기록(FK 충족).
-- relation_id = pending_id (deterministic) 이므로 멱등 재INSERT 가 같은 pk 로 충돌(23505)해 안전.
-- 삭제 소비(delivered_at 有 + relation_id NULL via FK set null) 와 미전달 크래시(delivered_at NULL) 구분.
--
-- additive — 안전하게 단일 트랜잭션 적용. cron 은 재등록하지 않고 purge 함수만 replace.

alter table public.pending_relation_registrations
  add column if not exists delivered_at timestamptz;

-- 백필: 이미 전달된(relation_id 살아있는) 행을 delivered 로 표시.
-- (현 시점 relation_id 살아있는 행이 없을 수 있으나 멱등·안전.)
update public.pending_relation_registrations
   set delivered_at = coalesce(materialized_at, now())
 where relation_id is not null
   and delivered_at is null;

-- purge 함수 갱신 — 미전달 판별을 materialized_at → delivered_at 으로.
-- (클레임만 되고 전달 실패한 행도 delivered_at IS NULL 이라 정리 대상에 자연 포함.)
create or replace function public.purge_pending_relation_drafts()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1) 미결제·미전달 30일 행 삭제 (paid 고아 보호)
  delete from public.pending_relation_registrations p
   where p.delivered_at is null
     and p.created_at < now() - interval '30 days'
     and not exists (
       select 1
         from public.payments pay
        where pay.charge_type = 'feature_use'
          and pay.feature_id = 'relation_slot'
          and pay.feature_ref = 'relation_slot:' || p.pending_id::text
          and pay.status in ('pending', 'confirmed')
     );

  -- 2) 전달완료/소비 행의 draft 스크럽 (7일 후). 미전달(delivered_at NULL)은 재INSERT 에
  --    draft 가 필요하므로 제외 — draft 보존.
  update public.pending_relation_registrations p
     set draft = '{}'::jsonb
   where p.delivered_at is not null
     and p.delivered_at < now() - interval '7 days'
     and p.draft <> '{}'::jsonb;
end $$;

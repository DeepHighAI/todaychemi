# db_schema.md — TWODAY Postgres DDL + RLS

> **모델 버전**: CRM 모델 v1.0 (2026-05-03)
> **권위 ADR**: ADR-011 (별명만, 실명 수집 금지), ADR-018 (모트 = 명리 정확성 자산)
> **단일 truth source**: 본 파일. 이전 fortune_architecture.md 부록 C는 폐기됨.

---

## 왜 birth_profiles 를 폐기했는가

`fortune_architecture.md`(v3.3 부록 C)는 `birth_profiles` 단일 테이블에 본인과 인연(관계 대상)을 모두 저장했다. 이는 다음 문제를 초래한다.

1. **ADR-011 위반 위험**: `nickname` 컬럼이 있음에도 인연 쪽에도 `name` 계열 컬럼이 슬며시 추가될 여지가 있다.
2. **도메인 불일치**: `users`(본인)와 `relations`(인연)은 서로 다른 CRM 엔티티다. 본인은 Google Auth로 가입된 실계정이고, 인연은 사용자가 입력한 별명 기반 레코드다.
3. **RLS 복잡도**: `owner_type = 'self' | 'family'` 분기로 정책을 나누는 것보다 테이블 분리가 명확하다.

**결론**: `users` (본인 프로필) + `relations` (인연, 별명만) 분리 모델로 전환한다.

---

## ER 다이어그램 (텍스트)

```
auth.users (Supabase Auth)
    │
    │ 1:1
    ▼
users ─────────────────────── user_charts (1:N)
    │                               │
    │ 1:N                           │ chart_hash (FK)
    ▼                               ▼
relations ──────────────── relation_charts (1:N)
    │
    │ 1:N
    ▼
hapcards ──────── hapcard_replays (1:N)
    │
    │ 1:N
    ▼
daily_haps

auth.users
    │
    │ 1:N
    ├── token_ledger
    ├── payments
    ├── push_subscriptions
    ├── notification_optins
    └── feedback_events

(system tables, service_role only)
prompt_versions
knowledge_assets
banned_phrase_hits
error_events
llm_cost_tracking
anon_requests
```

---

## DDL

### 0. 확장 활성화

```sql
-- supabase/migrations/0001_extensions.sql
create extension if not exists "pgcrypto";
create extension if not exists "vector";
create extension if not exists "pg_cron";
```

---

### 1. users

본인 프로필. Supabase Auth `auth.users`의 public 미러.
- 실명 수집 금지 (ADR-011). `nickname`은 본인이 스스로 지정하는 표시명.
- `email`은 계정 식별용으로만 저장. LLM 페이로드에 절대 포함 금지 (`docs/legal/pii_minimization.md`).

```sql
-- supabase/migrations/0002_users.sql
create table public.users (
  user_id          uuid        primary key references auth.users(id) on delete cascade,
  nickname         text        not null,
  birth_date       date        not null,
  birth_date_calendar text     not null check (birth_date_calendar in ('solar', 'lunar')),
  is_lunar_leap    boolean     not null default false,
  birth_time_knowledge text    not null check (birth_time_knowledge in ('exact', 'approximate', 'unknown')),
  birth_time       time,
  birth_time_range_from time,
  birth_time_range_to   time,
  gender           text        not null check (gender in ('M', 'F')),
  -- 개인정보 동의
  consented_at     timestamptz not null default now(),
  consented_tos_version text   not null,
  consented_privacy_version text not null,
  age_confirmed    boolean     not null default false,
  -- 온보딩
  first_result_viewed_at timestamptz,
  -- 계정 관리
  deletion_requested_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index on public.users (user_id);

alter table public.users enable row level security;
create policy "users_self_read"   on public.users for select using (auth.uid() = user_id);
create policy "users_self_insert" on public.users for insert with check (auth.uid() = user_id);
create policy "users_self_update" on public.users for update using (auth.uid() = user_id);
```

---

### 2. user_charts

본인 사주 계산 결과 캐시. `chart_hash`는 `sha256(birth_data + theory_profile_version)`.

```sql
-- supabase/migrations/0003_user_charts.sql
create table public.user_charts (
  chart_id              uuid    primary key default gen_random_uuid(),
  user_id               uuid    not null references public.users(user_id) on delete cascade,
  chart_hash            text    not null unique,
  chart_core            jsonb   not null,  -- pillars, day_master, five_elements_balance, sinsal_tags
  theory_profile_version text   not null,
  created_at            timestamptz not null default now()
);

create index on public.user_charts (user_id);
create index on public.user_charts (chart_hash);

alter table public.user_charts enable row level security;
create policy "user_charts_self" on public.user_charts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

---

### 3. relations

인연 레코드. 별명만 허용 (ADR-011). `nickname`이 유일한 식별자.
- `birth_place` 저장 금지. Expert Mode 경도 보정은 `birth_longitude`만.
- `gender`/`birth_date` 원본은 DB에 보관되지만 LLM 페이로드에는 절대 미전달 (`docs/legal/pii_minimization.md`).

```sql
-- supabase/migrations/0004_relations.sql
create table public.relations (
  relation_id      uuid    primary key default gen_random_uuid(),
  user_id          uuid    not null references public.users(user_id) on delete cascade,
  nickname         text    not null,                               -- ADR-011: 별명만
  mode             text    not null check (mode in (
                     '일합', '친구합', '돈합', '첫합', '썸합', '오래합'
                   )),
  birth_date       date    not null,
  birth_date_calendar text not null check (birth_date_calendar in ('solar', 'lunar')),
  is_lunar_leap    boolean not null default false,
  birth_time_knowledge text not null check (birth_time_knowledge in ('exact', 'approximate', 'unknown')),
  birth_time       time,
  birth_longitude  numeric(7,4),                                   -- Expert Mode 경도 보정용만
  gender           text    not null check (gender in ('M', 'F')),
  consent_confirmed boolean not null default false,                -- 인연 동의 확인
  is_primary       boolean not null default false,                 -- todayHap 기본 대상
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index on public.relations (user_id);
create index on public.relations (user_id, mode);

alter table public.relations enable row level security;
create policy "relations_own" on public.relations for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

---

### 4. relation_charts

인연 사주 계산 결과 캐시.

```sql
-- supabase/migrations/0005_relation_charts.sql
create table public.relation_charts (
  chart_id              uuid    primary key default gen_random_uuid(),
  relation_id           uuid    not null references public.relations(relation_id) on delete cascade,
  user_id               uuid    not null references public.users(user_id) on delete cascade,
  chart_hash            text    not null unique,
  chart_core            jsonb   not null,
  theory_profile_version text   not null,
  created_at            timestamptz not null default now()
);

create index on public.relation_charts (relation_id);
create index on public.relation_charts (user_id);

alter table public.relation_charts enable row level security;
create policy "relation_charts_own" on public.relation_charts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

---

### 5. hapcards

케미카드 (관계 사주 해석 결과). 6모드 분류. ADR-016: 결과 카드 6 컴포넌트.

```sql
-- supabase/migrations/0006_hapcards.sql
create table public.hapcards (
  hapcard_id       uuid    primary key default gen_random_uuid(),
  user_id          uuid    not null references public.users(user_id) on delete cascade,
  relation_id      uuid    not null references public.relations(relation_id) on delete cascade,
  mode             text    not null check (mode in (
                     '일합', '친구합', '돈합', '첫합', '썸합', '오래합'
                   )),
  compat_score     numeric(5,2) not null,   -- ADR-035: 결정형 점수, LLM 개입 금지
  score_breakdown  jsonb   not null,        -- 항목별 점수 (category_scores)
  content          jsonb   not null,        -- main_text, cause_factors, classic_citation, actions, why_cards
  target_date      date    not null,        -- KST 기준 분석 대상 날짜 (20260521011419 추가)
  prompt_version   text    not null,
  llm_model        text    not null,        -- gpt-5o | gpt-5 | gpt-5-mini | claude-fallback
  cache_key        text    not null unique,
  user_chart_hash  text    not null,
  relation_chart_hash text not null,
  archived_at      timestamptz,
  version_label    text,
  created_at       timestamptz not null default now()
);

create index on public.hapcards (user_id, relation_id, mode);
create index hapcards_daily_lookup_idx on public.hapcards (user_id, relation_id, mode, target_date desc);
create index on public.hapcards (user_id, created_at desc);
create index on public.hapcards (cache_key);

alter table public.hapcards enable row level security;
create policy "hapcards_own" on public.hapcards for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

---

### 6. hapcard_replays

케미 다시 맞추기 (재해석) 이력. ADR-015: 재해석 시 명리 근거 항상 표시.

```sql
-- supabase/migrations/0007_hapcard_replays.sql
create table public.hapcard_replays (
  replay_id        uuid    primary key default gen_random_uuid(),
  hapcard_id       uuid    not null references public.hapcards(hapcard_id) on delete cascade,
  user_id          uuid    not null references public.users(user_id) on delete cascade,
  replay_reason    text,                    -- 유저 입력 재해석 사유
  content          jsonb   not null,
  prompt_version   text    not null,
  llm_model        text    not null,
  created_at       timestamptz not null default now()
);

create index on public.hapcard_replays (hapcard_id);
create index on public.hapcard_replays (user_id, created_at desc);

alter table public.hapcard_replays enable row level security;
create policy "replays_own" on public.hapcard_replays for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

---

### 7. daily_haps

오늘 케미 (Daily Card). Lazy-first 생성. GPT-5 mini 모델.

```sql
-- supabase/migrations/0008_daily_haps.sql
create table public.daily_haps (
  hap_id                uuid    primary key default gen_random_uuid(),
  user_id               uuid    not null references public.users(user_id) on delete cascade,
  primary_relation_id   uuid    references public.relations(relation_id) on delete set null,
  target_date           date    not null,                           -- KST 기준
  headline              text    not null,
  headline_reason       text    not null,
  avoid_phrase          text    not null,
  avoid_phrase_reason   text    not null,
  favorable_action      text    not null,
  favorable_action_reason text  not null,
  source_packet_hash    text    not null,
  reused_from_yesterday boolean not null default false,
  llm_model             text    not null default 'gpt-5-mini',
  generated_at          timestamptz not null default now(),
  unique(user_id, target_date)
);

create index on public.daily_haps (user_id, target_date desc);

alter table public.daily_haps enable row level security;
create policy "daily_haps_own" on public.daily_haps for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 6개월 자동 삭제 (pg_cron)
select cron.schedule(
  'delete-old-daily-haps',
  '0 3 1 * *',
  $$delete from public.daily_haps where target_date < current_date - interval '6 months'$$
);
```

---

### 8. token_ledger

토큰 잔액 및 거래 이력.

```sql
-- supabase/migrations/0009_token_ledger.sql
create table public.token_ledger (
  ledger_id    uuid    primary key default gen_random_uuid(),
  user_id      uuid    not null references public.users(user_id) on delete cascade,
  delta        int     not null,            -- 양수=충전, 음수=차감
  reason       text    not null,            -- 'purchase' | 'hapcard_use' | 'hapcard_refund' | 'replay_use' | 'replay_refund' | 'whatif_use' | 'whatif_refund' | 'refund' | 'bonus'
  reference_id text,                        -- payment_id, hapcard_id 또는 share:<share_id>
  balance_after int    not null,
  created_at   timestamptz not null default now()
);

create index on public.token_ledger (user_id, created_at desc);
create index if not exists token_ledger_user_reason_reference_idx
  on public.token_ledger (user_id, reason, reference_id);

alter table public.token_ledger enable row level security;
create policy "ledger_own_read" on public.token_ledger for select using (auth.uid() = user_id);
-- insert는 service_role 전용
```

무료 부적 지급도 `reason='bonus'`를 사용한다. 세부 출처는 `reference_id` prefix로 구분한다: `daily_login:<YYYY-MM-DD>`, `signup:<user_id>`, `share:<share_id>`.

```sql
create or replace function public.award_free_talisman_session_rewards(
  uid uuid,
  p_auth_created_at timestamptz default null,
  p_policy_effective_at timestamptz default '2026-05-25T00:00:00+09:00'::timestamptz
)
returns jsonb;
```

정책: `public.users` 프로필이 있는 사용자에게만 지급한다. KST 기준 매일 첫 인증 앱 진입은 `+1`, 정책 기준일 이후 생성된 신규 사용자는 온보딩 완료 후 `+5`를 추가 지급한다. 기존 가입자는 가입 보상을 소급 지급하지 않으며, 가입 당일 일일 보상은 별도로 받을 수 있다.

---

### 9. payments

결제 이력. 토스페이먼츠 V2 위젯 pending 주문과 confirm 결과를 추적한다.

```sql
-- supabase/migrations/0010_payments.sql
create table public.payments (
  payment_id       uuid    primary key default gen_random_uuid(),
  user_id          uuid    not null references public.users(user_id) on delete cascade,
  toss_payment_key text    unique,          -- 결제 승인 전 NULL 가능
  toss_customer_key text,                   -- 서버 생성 UUID 기반 Toss customerKey
  toss_order_id    text    not null unique,
  product_id       text,
  amount_krw       int     not null,
  token_amount     int,                      -- legacy token-pack only; feature_use에서는 NULL
  charge_type      text    not null default 'token_charge',  -- 'token_charge'(legacy) | 'feature_use'
  feature_id       text    check (feature_id is null or feature_id in ('hapcard', 'whatif', 'replay', 'relation_slot')),  -- relation_slot: 20260610000000
  feature_ref      text,                     -- feature_use: cache_key | replay:{id}:{jinjin_date} | relation_slot:{pending_id}
  status           text    not null check (status in ('pending', 'confirmed', 'failed', 'refunded', 'tampered', 'invalid')),
  failure_code     text,
  failure_message  text,
  receipt_url      text,
  confirmed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- feature_use는 feature_id+feature_ref 필수·product_id 없음; token_charge는 그 반대
  constraint payments_feature_use_shape check (
    (charge_type = 'feature_use' and feature_id is not null and feature_ref is not null and product_id is null)
    or (charge_type = 'token_charge' and feature_id is null and feature_ref is null)
  )
);

create index on public.payments (user_id, created_at desc);
create index on public.payments (toss_order_id);
create index on public.payments (user_id, status, created_at desc);
create unique index payments_feature_open_uidx
  on public.payments (user_id, feature_id, feature_ref)
  where charge_type = 'feature_use' and status in ('pending', 'confirmed');

alter table public.payments enable row level security;
create policy "payments_own_read" on public.payments for select using (auth.uid() = user_id);
-- insert/update는 service_role 전용 (/api/payments/feature/init, /api/payments/feature/confirm)

-- supabase/migrations/20260601000000_feature_pay_per_use.sql
create or replace function public.confirm_feature_payment(...)
returns text;
```

### pending_relation_registrations — 인연 등록 슬롯 스테이징 (ADR-039 §9)

인연 등록 슬롯 과금(모델 B)의 draft 스테이징 테이블. `POST /api/relations` 는 보유 인연이
`FREE_RELATION_SLOTS`(=2) 이상이면 검증된 draft 를 여기 스테이징한 뒤 과금하고
(`feature_ref = relation_slot:{pending_id}`), 부적/현금 결제 성공 시 머티리얼라이즈
(relations INSERT)한다. 행은 머티리얼라이즈 후에도 삭제하지 않고 `materialized_at` 으로
마킹만 한다(confirm 재진입 ref 소유 검증 + 멱등). `relations` 읽기 사이트는 변경 없음.

```sql
-- supabase/migrations/20260610000000_relation_slot_registration.sql
create table public.pending_relation_registrations (
  pending_id      uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(user_id) on delete cascade,
  draft           jsonb not null,            -- 검증된 RelationCreate 페이로드
  relation_id     uuid references public.relations(relation_id) on delete set null,
  materialized_at timestamptz,               -- 멱등 마커. NULL+confirmed 결제 = lazy recovery 대상
  created_at      timestamptz not null default now()
);
create index pending_relation_registrations_user_created_idx
  on public.pending_relation_registrations (user_id, created_at desc);
alter table public.pending_relation_registrations enable row level security;
create policy "pending_relation_registrations_own" on public.pending_relation_registrations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 같은 마이그레이션에서 token_ledger 멱등 부분 유니크 인덱스 2개와
-- deduct_tokens_once/refund_tokens_once IN-list 에 'relation_slot_use'/'relation_slot_refund' 추가.
```

---

### 10. push_subscriptions

FCM 푸시 구독.

```sql
-- supabase/migrations/0011_push_subscriptions.sql
create table public.push_subscriptions (
  subscription_id uuid    primary key default gen_random_uuid(),
  user_id         uuid    not null references public.users(user_id) on delete cascade,
  fcm_token       text    not null,
  device_type     text    not null check (device_type in ('android', 'ios', 'web')),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index on public.push_subscriptions (user_id, is_active);

alter table public.push_subscriptions enable row level security;
create policy "push_subs_own" on public.push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

---

### 11. notification_optins

알림 수신 동의.

```sql
-- supabase/migrations/0012_notification_optins.sql
create table public.notification_optins (
  user_id        uuid    primary key references public.users(user_id) on delete cascade,
  daily_hap      boolean not null default true,
  hapcard_ready  boolean not null default true,
  marketing      boolean not null default false,
  updated_at     timestamptz not null default now()
);

alter table public.notification_optins enable row level security;
create policy "notif_optins_own" on public.notification_optins for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

---

### 12. prompt_versions

프롬프트 카나리 배포 관리. ADR-008.

```sql
-- supabase/migrations/0013_prompt_versions.sql
create table public.prompt_versions (
  prompt_name  text    not null,
  version      text    not null,
  content      text    not null,
  status       text    not null check (status in ('active', 'canary', 'rolled_back')),
  canary_ratio numeric(3,2) check (canary_ratio >= 0 and canary_ratio <= 1),
  notes        text,
  created_at   timestamptz not null default now(),
  primary key  (prompt_name, version)
);

-- prompt_name 당 active 버전은 하나만
create unique index prompt_versions_one_active
  on public.prompt_versions (prompt_name)
  where status = 'active';

alter table public.prompt_versions enable row level security;
create policy "prompt_versions_public_read" on public.prompt_versions
  for select using (true);
-- write는 service_role 전용
```

---

### 13. knowledge_assets

RAG 자산. 고전 원문 + 개념 사전 + 현대 해석.

```sql
-- supabase/migrations/0014_knowledge_assets.sql
create table public.knowledge_assets (
  asset_id      text    primary key,
  asset_type    text    not null check (asset_type in (
                  'classic', 'concept_dict', 'modern_translation', 'safety_rule'
                )),
  domain        text,
  topic_tags    text[]  not null default '{}',
  content       jsonb   not null,
  embedding     vector(1536),
  share_card_url text,
  version       text    not null,
  review_status text    not null check (review_status in (
                  'draft',
                  'approved_ai_pending_human',
                  'approved_ai_and_crowd',
                  'approved_ai_crowd_and_beta',
                  'deprecated'
                )),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on public.knowledge_assets using hnsw (embedding vector_cosine_ops);
create index on public.knowledge_assets (asset_type, review_status);
create index on public.knowledge_assets using gin (topic_tags);

alter table public.knowledge_assets enable row level security;
create policy "knowledge_assets_public_read" on public.knowledge_assets
  for select using (true);
-- write는 service_role 전용
```

---

### 14. banned_phrase_hits

금지어 감지 이벤트 로그.

```sql
-- supabase/migrations/0015_banned_phrase_hits.sql
create table public.banned_phrase_hits (
  hit_id         uuid    primary key default gen_random_uuid(),
  prompt_version text    not null,
  phrase_category text   not null,    -- 'generic_encouragement' | 'context_blind' | ...
  phrase_matched text    not null,
  hapcard_id     uuid    references public.hapcards(hapcard_id) on delete set null,
  created_at     timestamptz not null default now()
);

create index on public.banned_phrase_hits (prompt_version, created_at desc);
create index on public.banned_phrase_hits (phrase_category);
-- RLS 없음 (service_role 전용 write, admin read)
```

---

### 15. error_events

에러 이벤트 로그. Sentry와 병행 저장.

```sql
-- supabase/migrations/0016_error_events.sql
create table public.error_events (
  event_id       uuid    primary key default gen_random_uuid(),
  user_id        uuid    references public.users(user_id) on delete set null,
  error_code     text    not null,
  chart_hash     text,
  prompt_version text,
  context        jsonb,
  stack          text,
  created_at     timestamptz not null default now()
);

create index on public.error_events (error_code, created_at desc);
create index on public.error_events (user_id, created_at desc);
-- service_role write only
```

---

### 16. llm_cost_tracking

LLM 비용 추적. 일별 공급사별 집계.

```sql
-- supabase/migrations/0017_llm_cost_tracking.sql
create table public.llm_cost_tracking (
  date        date    not null,
  provider    text    not null check (provider in ('openai', 'anthropic')),
  model       text    not null,   -- 'gpt-5o' | 'gpt-5' | 'gpt-5-mini' | 'claude-fallback'
  total_usd   numeric(10,4) not null default 0,
  call_count  int     not null default 0,
  token_in    bigint  not null default 0,
  token_out   bigint  not null default 0,
  primary key (date, provider, model)
);

alter table public.llm_cost_tracking enable row level security;
-- service_role read/write only
```

---

### 17. anon_requests

비회원 IP 레이트 리밋 버킷.

```sql
-- supabase/migrations/0018_anon_requests.sql
create table public.anon_requests (
  ip_hash       text    not null,
  bucket_minute timestamptz not null,   -- truncated to minute
  count         int     not null default 1,
  primary key   (ip_hash, bucket_minute)
);

-- 10분 지난 버킷 자동 삭제
select cron.schedule(
  'cleanup-anon-requests',
  '*/10 * * * *',
  $$delete from public.anon_requests where bucket_minute < now() - interval '10 minutes'$$
);
```

---

### 18. feedback_events

유저 피드백 (좋아요/싫어요). QR 회귀 감지 원천.

```sql
-- supabase/migrations/0019_feedback_events.sql
create table public.feedback_events (
  event_id          uuid    primary key default gen_random_uuid(),
  user_id           uuid    not null references public.users(user_id) on delete cascade,
  target_type       text    not null check (target_type in (
                      'hapcard', 'hapcard_replay', 'daily_hap', 'knowledge_asset'
                    )),
  target_id         text    not null,
  signal            text    not null check (signal in ('thumbs_up', 'thumbs_down', 'inspect')),
  quality_issue_flag text   check (quality_issue_flag in (
                      'generic', 'vague', 'wrong_context', 'classic_translation', 'other'
                    )),
  quality_issue_note text,
  created_at        timestamptz not null default now()
);

create index on public.feedback_events (target_type, target_id);
create index on public.feedback_events (user_id, created_at desc);
create index on public.feedback_events (signal, created_at desc);

alter table public.feedback_events enable row level security;
create policy "feedback_own_insert" on public.feedback_events
  for insert with check (auth.uid() = user_id);
create policy "feedback_own_read" on public.feedback_events
  for select using (auth.uid() = user_id);
```

---

### 19. whatif_results

마이플레이 6종 LLM 응답 캐시 (S-08, DiagnosticType). Self-anchor — relation 없음, scoring 없음.

```sql
-- supabase/migrations/0026_whatif_results.sql
create table public.whatif_results (
  whatif_id        uuid    primary key default gen_random_uuid(),
  user_id          uuid    not null references public.users(user_id) on delete cascade,
  type             text    not null check (type in (
                     'work', 'love', 'conflict', 'leadership', 'money', 'first_meet'
                   )),
  content          jsonb   not null,        -- WhatifContent: body+keywords+do_first+first_meet_tips?
  prompt_version   text    not null,
  llm_model        text    not null check (llm_model in (
                     'gpt-5o', 'gpt-5', 'gpt-5-mini', 'claude-fallback'
                   )),
  cache_key        text    not null unique,  -- sha256(chart_hash + type + prompt_version)
  chart_hash       text    not null,
  created_at       timestamptz not null default now()
);

create index on public.whatif_results (user_id, type, created_at desc);
create index on public.whatif_results (cache_key);

alter table public.whatif_results enable row level security;
create policy "whatif_results_own" on public.whatif_results for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

---

### 20. hapcard_shares / hapcard_share_rewards

공개 공유 링크와 공유 성공 보상 멱등성. 원문 공개 토큰은 저장하지 않고 `token_hash`만 저장한다.

```sql
-- supabase/migrations/20260524090000_hapcard_shares.sql
create table public.hapcard_shares (
  share_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  hapcard_id uuid not null references public.hapcards(hapcard_id) on delete cascade,
  relation_id uuid not null references public.relations(relation_id) on delete cascade,
  token_hash text not null unique,
  range text not null check (range in ('nickname-only', 'nickname-ohaeng', 'nickname-gender')),
  channel text not null check (channel in ('kakao', 'web_share', 'instagram', 'copy_link')),
  title text not null,
  message_text text not null,
  expires_at timestamptz not null default (now() + interval '30 days')
);

create table public.hapcard_share_rewards (
  reward_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  hapcard_id uuid not null references public.hapcards(hapcard_id) on delete cascade,
  share_id uuid not null references public.hapcard_shares(share_id) on delete cascade,
  channel text not null check (channel in ('kakao')),
  ledger_id uuid references public.token_ledger(ledger_id) on delete set null,
  reward_date_kst date not null,
  webhook_resource_id text,
  unique (user_id, hapcard_id),
  unique (share_id)
);

create or replace function public.award_hapcard_share_reward(...)
returns jsonb;
```

보상 정책: Kakao webhook으로 검증된 공유 완료 시에만 `token_ledger.reason='bonus'`, `delta=+1`, `reference_id='share:<share_id>'`를 기록한다. 같은 사용자+hapcard는 1회만 지급하고 KST 기준 하루 최대 5회까지만 지급한다. Instagram/Web Share/copy/download는 공유 기능만 제공하고 보상 지급 근거로 쓰지 않는다.

---

### 21. legal_consents

회원가입/OAuth 시작 전 필수 약관 동의를 서버 소유 레코드로 저장한다. 원문 nonce token은 HttpOnly cookie로만 내려가며 DB에는 `token_hash`만 저장한다.

```sql
-- supabase/migrations/20260525110000_legal_consents.sql
create table public.legal_consents (
  consent_id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete cascade,
  token_hash text not null unique,
  flow text not null check (flow in ('email', 'oauth', 'guest')),
  provider text check (provider in ('google', 'kakao')),
  terms_version text not null,
  privacy_version text not null,
  age_confirmed boolean not null default false,
  consented_at timestamptz not null default now(),
  expires_at timestamptz not null,
  claimed_at timestamptz
);
```

`provider`는 `oauth` flow에서만 필수이며 `email`/`guest` flow에서는 `null`이어야 한다. `/api/legal/consent`가 레코드를 만들고 `osa_legal_consent` HttpOnly SameSite=Lax cookie를 발급한다. Email/OAuth TTL은 30분, guest TTL은 24시간이다. `/auth/callback`과 `/api/onboarding`은 이 nonce를 claim하거나 최신 서버 레코드를 읽어 `public.users`의 동의 컬럼을 채운다. 게스트 선체험은 `auth_user_id=null` 상태로 `/api/guest/today`에서만 사용하고, 가입 전환 후 `/guest/complete`의 인증 온보딩 과정에서 사용자에게 연결된다.

---

## 삭제 Grace Period 함수

```sql
-- supabase/migrations/0020_deletion_grace.sql
create or replace function public.purge_deleted_users()
returns void language plpgsql security definer as $$
begin
  -- 30일 grace period 경과 후 auth.users 삭제 (cascade 로 관련 데이터 삭제)
  delete from auth.users
  where id in (
    select user_id from public.users
    where deletion_requested_at is not null
      and deletion_requested_at < now() - interval '30 days'
  );
end $$;

select cron.schedule(
  'purge-deleted-users',
  '0 4 * * *',
  $$select public.purge_deleted_users()$$
);
```

---

## 주의사항

- `gender`, `birth_date` 컬럼은 DB에 저장되지만 LLM 페이로드에 절대 포함하지 않는다. 구체적 규칙은 `docs/legal/pii_minimization.md` 참조.
- `relations.nickname`은 인연의 유일한 식별자다. `name`, `displayName` 컬럼 추가 금지 (ADR-011).
- `hapcards.compat_score`는 `compatibility_scoring_spec.md` 결정형 알고리즘으로 산출한다. LLM은 점수 산출에 개입 금지 (ADR-035).
- 모든 LLM 호출 모델은 OpenAI 4-tier (gpt-5 / gpt-5-mini) 우선, 장애 시 Anthropic Claude fallback.

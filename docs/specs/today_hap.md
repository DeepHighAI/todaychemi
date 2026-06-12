# today_hap.md — 오늘 케미 (Daily Card) 파이프라인 명세

> **Status: 구현 완료 (2026-06-13 문서 동기)** — PR-A1/A2(2026-05-06) + Phase 3 G2 인연 종합(2026-05-28)로 전체 구현됨.
> 단, 구현은 본 명세와 일부 다름: Edge Function 대신 **Next.js Route Handler**(`/api/today`), 모델은 G2에서 **GPT-5 격상**(3축 인연 종합), 캐시에 relation 축 추가. 차이는 코드·CLAUDE.md §2가 진실.
> 본 파일의 미구현 체크리스트는 설계 사료로 보존.

> **Phase**: 1.0 (MVP 출시 시 포함)
> **모델**: ~~GPT-5 mini~~ → GPT-5 (2026-05-28 G2 격상)
> **단일 truth source**: 구현 코드(`src/lib/today/`, `src/app/api/today/`). 본 파일은 설계 사료.

---

## 1. 생성 모델: Lazy-first

| 후보 | 채택 | 이유 |
|---|---|---|
| Eager (00:00 KST 일괄 생성) | 미채택 | 비활성 유저 분까지 비용 지출 |
| **Lazy (첫 앱 오픈 시 실시간 생성)** | **채택** | 실제 활성 유저 분만 비용 지출, MVP 단순성 |
| Hybrid (30일 내 활성 유저 prewarm) | Phase 1.1+ 검토 | 스케줄러 복잡도 증가 |

---

## 2. 모델 선택 근거

**GPT-5 mini (`gpt-5-mini`)**: Daily Card는 짧고 반복성 높은 출력(300 out tokens). gpt-5는 과잉. 비용 최소화 우선.

| 항목 | 값 |
|---|---|
| 모델 | `gpt-5-mini` |
| 프롬프트 토큰 | in ~1,500 |
| 출력 토큰 | out ~300 |
| 총 토큰 | ~1,800 / 건 |

---

## 3. 비용 추산

| 가정 | 값 |
|---|---|
| DAU | 1,000 |
| 재방문율 (Daily Card 조회율) | 40% |
| 일 Daily Hap 호출 | 400 건 |
| 건당 비용 (gpt-5-mini 추정) | ~$0.001 |
| **월 비용 (30일)** | **≈ $3~5** |

---

## 4. daily_haps 테이블 (캐시)

`docs/specs/db_schema.md` §7 참조. 핵심 컬럼:

```sql
daily_haps (
  user_id               uuid,      -- 소유자
  primary_relation_id   uuid,      -- todayHap 기준 인연 (nullable)
  target_date           date,      -- KST 기준 날짜
  headline              text,      -- 오늘의 핵심 메시지
  headline_reason       text,
  avoid_phrase          text,      -- 오늘 조심할 말·행동
  avoid_phrase_reason   text,
  favorable_action      text,      -- 오늘 유리한 행동
  favorable_action_reason text,
  source_packet_hash    text,      -- chart_core + date hash
  reused_from_yesterday boolean,   -- 폴백 표시
  llm_model             text,      -- 'gpt-5-mini'
  UNIQUE (user_id, target_date)
)
```

---

## 5. 타임존: KST 날짜 정규화

- 카드 유효일 판단은 유저 현재시각 기준 KST `YYYY-MM-DD`
- Edge Function `supabase/functions/daily-hap/` 가 `(user_id, target_date)` 조회
- 없으면 생성 → `daily_haps` upsert → 반환
- 00:00 KST에 이전 날 카드는 자동 만료 (클라이언트 다음 접속 시 신규 요청)

```typescript
// KST 날짜 계산
const kstDate = new Date(
  new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })
).toISOString().slice(0, 10);
```

---

## 6. 실패 폴백 3단계

| 순서 | 폴백 | 표시 |
|---|---|---|
| 1순위 | 전날 카드 재사용 | `reused_from_yesterday: true` 플래그 + UI 안내 |
| 2순위 | 고정 템플릿 메시지 | "오늘 메시지를 준비하지 못했어요. 내일 다시 찾아주세요." |
| 3순위 | 카드 섹션 자체 숨김 | 홈에서 Daily Card 컴포넌트 미노출 |

---

## 7. 캐시 및 스토리지 정책

- `daily_haps` 테이블에 영구 저장 (유저 아카이브 기능 대비)
- 6개월 이상 지난 카드는 월 1회 배치 삭제 (pg_cron)

```sql
select cron.schedule(
  'delete-old-daily-haps',
  '0 3 1 * *',  -- 매월 1일 03:00 KST
  $$delete from public.daily_haps where target_date < current_date - interval '6 months'$$
);
```

---

## 8. Phase 1.0 체크리스트

- [ ] `daily_haps` 테이블 + RLS (db_schema.md §7)
- [ ] `supabase/functions/daily-hap/` Edge Function
- [ ] gpt-5-mini 전용 프롬프트 `src/prompts/daily_hap.md`
- [ ] Lazy 생성 로직 (첫 앱 오픈 시 캐시 미스 → 실시간 생성)
- [ ] KST 기준 날짜 판정
- [ ] 실패 폴백 3단계 구현
- [ ] 홈 탭 Daily Hap 컴포넌트
- [ ] `reused_from_yesterday` UI 표시
- [ ] 6개월 만료 배치 (pg_cron 월 1회)

**예상 공수**: 약 3일 (Phase 1.0에 포함)

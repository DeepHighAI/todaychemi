# 수동 마이그레이션 적용 + history repair

`pnpm db:push` 대신 Supabase Dashboard SQL 에디터로 마이그레이션을 직접 적용할 때의 절차.
(예: 2026-06-10 `20260610000000_relation_slot_registration.sql` 적용 사례)

## 왜 repair 가 필요한가

`pnpm db:push` 는 두 가지를 한다:

1. SQL 적용
2. `supabase_migrations.schema_migrations` 부기 테이블에 버전 기록

SQL 에디터 직접 실행은 ①만 수행한다. ②가 빠지면 **다음 `db:push` 가 같은 파일을
재적용하려다 `already exists` 류 에러로 실패**한다. `migration repair` 는 ②만 따로
채우는 명령이다 — 스키마는 건드리지 않고 부기 테이블에 1행 추가.

## 절차

### Step 1 — SQL 실행 (사용자, Dashboard)

1. Supabase Dashboard → 프로젝트 `jamhkucluhiibqpjsiov`(goonghap) → SQL Editor
2. 로컬 마이그레이션 파일(`supabase/migrations/<버전>_<이름>.sql`) 내용 **전체** 복사
3. 붙여넣고 **Run 1회로 전체 실행** — 가장 중요한 규칙:
   - 전체를 한 번에 실행하면 Postgres 가 단일 암묵 트랜잭션으로 처리 →
     중간 실패 시 전체 롤백(부분 적용 상태 없음)
   - 일부 구문만 드래그 선택해 "Run selected" 금지 — 구문별 autocommit 이 되면
     부분 적용이 생길 수 있다 (예: 인덱스 drop↔create 사이 멱등 보장 공백)
4. `Success. No rows returned` 확인. 에러 시 메시지를 그대로 Claude 에 전달
   (전체 롤백 상태이므로 수정 후 재시도 가능)
5. 여러 파일이 밀려 있으면 **타임스탬프 오름차순으로 한 파일씩** 반복

### Step 2 — Claude 에 repair 요청

"`<버전>` 적용했어, repair 해줘" 한 마디면 된다. Claude 가 실행하는 것:

```bash
pnpm dlx supabase migration list --linked        # remote 열에 해당 버전 누락 확인
pnpm dlx supabase migration repair --status applied <버전>
pnpm dlx supabase migration list --linked        # local/remote 동기화 확인
```

잘못 기록한 경우 되돌리기: `migration repair --status reverted <버전>`.

### Step 3 — 검증 (선택)

사용자가 SQL 에디터에서 바로 확인하거나, Claude 에 검증을 요청한다.

```sql
-- 함수 존재
select proname from pg_proc where proname = '<함수명>';
-- cron 등록 (pg_cron 사용 마이그레이션)
select jobname, schedule, active from cron.job where jobname = '<job명>';
-- 테이블/컬럼: Table Editor 또는 select ... limit 0
```

Claude 측 검증 도구: `pnpm test:integration`(라이브 RLS) ·
`pnpm tsx --env-file=.env.local scripts/verify-relation-slot-migration.ts`(전용 검증 스크립트 패턴).

## 주의

- **repair 는 SQL 적용 성공을 확인한 뒤에만** — 적용 안 된 버전을 applied 로 기록하면
  db:push 가 그 파일을 영원히 건너뛴다(스키마-history 불일치의 반대 방향 desync).
- history 가 동기화된 평상시에는 `pnpm db:push:dry` → `pnpm db:push` 가 더 간단하다
  (적용+기록 자동). 수동 방식은 Dashboard 에서 직접 보면서 적용하고 싶을 때만.

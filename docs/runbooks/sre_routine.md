# sre_routine.md — SRE 정기 루틴

---

## 1. 모니터링 대시보드 4패널

### 1.1 /admin/sre (Phil 전용, email allowlist)

| 패널 | 데이터 소스 | 갱신 주기 |
|---|---|---|
| LLM 일 비용 (일 상한 대비 %) | `llm_cost_tracking` | 실시간 |
| 에러율 (5분 이동 평균) | Sentry + `error_events` | 실시간 |
| banned_phrase 감지율 | `banned_phrase_hits` | 1시간 |
| Free tier 사용량 | Supabase Dashboard API | 1일 |

### 1.2 추가 패널

- 프롬프트 버전 현황 (active / canary 버전 표시)
- LLM-as-judge 최근 평점 추이 (주간)
- 유저 피드백 집계 (👍/👎/🔍 비율)
- 비상 공지 시스템 ON/OFF 토글

---

## 2. 주간 SRE 리포트 (자동 생성)

GitHub Actions 매주 월요일 03:30 KST 실행:

```yaml
# .github/workflows/weekly-sre-report.yml
name: Weekly SRE Report
on:
  schedule:
    - cron: '30 18 * * 0'  # 일요일 18:30 UTC = 월요일 03:30 KST
jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - name: Generate report
        run: pnpm tsx scripts/weekly-sre-report.ts
        # 출력: reports/sre-YYYY-WW.md
      - name: Slack 알림
        uses: slackapi/slack-github-action@v1
        with:
          payload: '{"text": "SRE 주간 리포트 완료"}'
```

### 리포트 포함 항목

```markdown
# SRE 주간 리포트 YYYY-WW

## KPIs
- DAU / WAU / MAU
- 회원가입 전환율 (비회원 → 회원)
- Daily Hap 조회율
- 합카드 생성 수

## LLM 지표
- 총 LLM 호출 수 / 비용
- 공급사별 비용 (OpenAI / Anthropic)
- banned_phrase 감지율
- LLM-as-judge 평균 점수

## 에러
- 에러 TOP 10 (code + count)
- 신규 에러 패턴

## 유저 피드백
- 👍/👎/🔍 비율
- 최다 부정 피드백 유형

## Action Items
- [ ] 항목 1
- [ ] 항목 2
```

---

## 3. 정기 작업 일정

| 주기 | 작업 |
|---|---|
| 매일 | `llm_cost_tracking` 일 예산 확인 |
| 매주 월요일 | SRE 주간 리포트 + LLM-as-judge 회귀 실행 |
| 매주 수요일 | 리포트 리뷰 + Action Items 도출 |
| 매월 1일 | old daily_haps 배치 삭제 (pg_cron 자동) |
| 매월 1일 | Supabase free tier 사용량 점검 |
| 분기 1회 | API 키 로테이션 (`api_key_rotation.md`) |
| Phase 1 출시 후 1개월 내 | Supabase PITR 복원 드릴 1회 |

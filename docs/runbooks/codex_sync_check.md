# Codex 세션 시작 동기화 체크 (Codex agent client 인계)

> 목적: Codex agent client(OpenAI Codex CLI)가 이 저장소에서 **이어서 개발**하기 전에,
> 자신의 컨텍스트가 Claude Code 측 작업과 동기 상태인지 스스로 검증하는 절차.
> Codex의 표준 진입점은 저장소 루트 `AGENTS.md`(= `CLAUDE.md`의 Codex 측 미러, §12 동기화 의무).
>
> 이 파일은 사용자가 Codex에 붙여넣을 **프롬프트**와, Codex가 직접 `cat` 해서 따를 **절차**를 함께 담는다.
> 재실행 안전(전부 읽기 전용 체크).

---

## 1. 동기화 앵커 (2026-06-22 핸드오프 기준)

| 신호 | 기대값 |
|---|---|
| `git rev-parse HEAD` | `b04ab0cab123890a5da47654d8ba020f8cf184ef` (`b04ab0c`) **또는 그 이후 커밋** |
| `git rev-parse origin/main` | **HEAD와 동일** (이게 진짜 동기 신호 — 해시 고정 아님) |
| `git status --short` | **오직** `?? assets/appintoss/products/` 한 줄 |
| 미니앱 테스트 | `cd miniapp && pnpm test` → **235/235 PASS**, `pnpm typecheck` → tsc 0 |
| 루트 게이트 | `pnpm tsc` · `pnpm lint` · `pnpm test` 그린 |
| Supabase ref | `jamhkucluhiibqpjsiov` (`goonghap`) — `pnpm db:status`, `pnpm db:push:dry` "up to date" |
| AGENTS.md §2 최신 항목 | `2026-06-22` "`.ait` 재빌드 + dev-bearer 하드닝" |

> **HEAD 해시는 참조 앵커일 뿐이다.** 그 사이 새 커밋이 main에 들어갔어도 `HEAD == origin/main`
> 이고 working tree가 깨끗하면 정상 동기 상태다. stale 판정은 `HEAD != origin/main`(fetch 후)
> 또는 위 한 줄 외 변경이 있을 때만.

## 2. 현재 상태 요약 (Codex가 이어받는 지점)

- 미니앱(앱인토스, `miniapp/` Vite SPA) **디자인 정렬 Phase 0–7 + `.ait` dev-bearer 하드닝까지 `main` 반영 완료**. 마스터 플랜 종료.
- 코드/DB 측 미해결 작업 없음(그린 베이스라인). 미해결은 **전부 사용자측 수동(코드 아님)**:
  1. 최종 `miniapp/todaychemi.ait`(deploymentId `019eeb3d`) **토스 콘솔 업로드**.
  2. **IAP SKU 맵 공란**(`miniapp/.env.local`의 `VITE_TOSS_IAP_SKU_MAP` 전부 `""`) → 페이월 UI는 보이나 실결제는 콘솔 SKU 등록 + `.env.local` 입력 후 동작.
  3. **Vercel Toss env**(mTLS PEM·`TOSS_USER_PASSWORD_SECRET`·SKU map·`NEXT_PUBLIC_APP_URL`) — 실기기 인증/IAP 동작 전제.
- 다음 개발 방향은 사용자 지시 대기.

## 3. Codex-on-Windows 주의 (필독)

- **프로덕션 빌드(`pnpm build` / `ait build`) 전** `miniapp/.env.local`의 `VITE_DEV_BEARER`는 **반드시 빈 값**. 값이 있으면 빌드 가드(`miniapp/scripts/assert-no-dev-bearer.ts`)가 산출물 생성 전 빌드를 실패시킨다(dev-bearer JWT가 `.ait` 번들에 인라인되는 것 방지 — `import.meta.env.DEV` 런타임 게이트만으로는 vite8/rolldown이 토큰 문자열을 DCE하지 못함). 로컬 dev 재개는 `pnpm mint:dev-bearer --write`, **빌드 전 다시 blank**.
- Codex의 read-only 샌드박스에서 `git`/`pnpm` subprocess spawn이 실패하면(`windows sandbox: spawn setup refresh`) 위 명령을 **직접 돌리지 말고** 사용자에게 실행을 요청해 출력을 받는다. (diff 리뷰가 필요하면 diff를 프롬프트에 임베드하거나 stdin으로 전달.)

## 4. 붙여넣기용 프롬프트 (사용자 → Codex)

```
너는 지금부터 C:\DEV\SAJU (GitHub DeepHighAI/todaychemi, 오늘케미/TWODAY) 저장소에서
이어서 개발한다. 코드를 만지기 전에 컨텍스트 동기화부터 검증하고 한국어로 보고해라.

[0] 규칙 로드
  - C:\DEV\SAJU\AGENTS.md (이 저장소 전용 규칙 + §2 현황 로그 — Codex 진입점)
  - C:\DEV\CLAUDE.md (보편 규칙)
  반드시 준수: §1.1 중요 결정(ADR·가격·스키마·스택·프롬프트·PII)은 임의 진행 말고
  사용자 승인 · §1.4 컨텍스트 60% 시 압축·인계 · §1.7 사용자 보고는 한국어 ·
  §3 비협상 ADR(특히 ADR-035 점수 결정형·ADR-038 한자 노출 금지·ADR-039 pay-per-use) ·
  §5 PII/ZDR(외부 LLM에 birth_date·name·nickname·email·birth_place·gender 절대 금지).

[1] git 동기화 확인 (실행 후 출력 보고)
  git -C C:/DEV/SAJU fetch origin
  git -C C:/DEV/SAJU rev-parse HEAD          # 기대(2026-06-22 핸드오프 시점): b04ab0c…
  git -C C:/DEV/SAJU rev-parse origin/main   # HEAD 와 동일해야 함
  git -C C:/DEV/SAJU status --short          # 오직 "?? assets/appintoss/products/" 한 줄
  판정: HEAD == origin/main 이고 위 한 줄 외 변경이 없으면 working tree 동기.
        (그 사이 새 커밋이 있었어도 HEAD==origin/main 이면 정상 — 해시 고정 아님.)

[2] 현황 최신성 확인
  AGENTS.md §2 최신 항목이 2026-06-22 "`.ait` 재빌드 + dev-bearer 하드닝"인지 확인.
  안 보이면 네 AGENTS.md 가 stale → 다시 읽어라.

[3] 그린 베이스라인 (실제 작업 전 1회 권장)
  cd C:/DEV/SAJU/miniapp && pnpm typecheck   # tsc 0
  cd C:/DEV/SAJU/miniapp && pnpm test         # 235/235 PASS
  cd C:/DEV/SAJU && pnpm tsc && pnpm lint && pnpm test   # 루트 게이트
  pnpm db:status   # Supabase ref jamhkucluhiibqpjsiov(goonghap) 링크 확인

[4] Windows / Codex 주의
  - 프로덕션 빌드(pnpm build/ait build) 전 miniapp/.env.local 의 VITE_DEV_BEARER 는
    반드시 빈 값. 비어있으면 OK; 값이 있으면 빌드 가드(assert-no-dev-bearer.ts)가
    빌드를 실패시킨다(dev-bearer JWT 번들 인라인 방지). 로컬 dev 재개는
    `pnpm mint:dev-bearer --write`, 빌드 전 다시 blank.
  - 네 read-only 샌드박스에서 git/pnpm subprocess spawn 이 실패하면(Windows sandbox
    트랩) 위 명령을 직접 돌리지 말고 사용자에게 실행을 요청해 출력을 받아라.

[5] 동기화 판정 보고 (한국어): IN SYNC / STALE + 불일치 항목.
  그다음 무엇을 이어서 개발할지 사용자에게 물어라. 참고: 미니앱 디자인 정렬
  Phase 0–7 + .ait 하드닝까지 main 반영 완료. 미해결은 전부 사용자측 수동(코드 아님):
  최종 .ait 토스 콘솔 업로드 · IAP SKU 맵 공란(VITE_TOSS_IAP_SKU_MAP) · Vercel Toss env.
```

## 5. 갱신 의무

이 런북의 §1 앵커(HEAD 해시·테스트 카운트)와 §2 상태 요약은 **현황 스냅샷**이다.
큰 작업이 main에 반영될 때마다 `AGENTS.md §2`(+ `CLAUDE.md §2`, §12 동시 갱신)와 함께
이 파일의 앵커도 갱신한다. Codex가 stale 앵커로 false-alarm 내지 않도록, 동적 신호
(`HEAD == origin/main` + 깨끗한 working tree)를 1차 판정 기준으로 둔다.

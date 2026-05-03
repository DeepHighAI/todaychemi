# CI/CD Policy

> 본 문서는 GitHub Actions CI, Vercel 배포, Bubblewrap TWA 빌드 정책을 기술한다.
> 실제 워크플로우 파일: `.github/workflows/ci.yml` (프로젝트 루트)

---

## 1. GitHub Actions CI — 4개 Job

### 전체 파이프라인 구조

```
push / pull_request (main, feature/*, fix/*)
  │
  ├─ [job: typecheck]   pnpm tsc --noEmit
  ├─ [job: lint]        pnpm lint (ESLint + Prettier check)
  ├─ [job: vitest]      pnpm vitest run --coverage
  └─ [job: playwright]  pnpm playwright test (Post-PR-1 이후 활성화)
```

### Job 1: typecheck

```yaml
typecheck:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v3
      with: { version: 9 }
    - uses: actions/setup-node@v4
      with: { node-version: '20', cache: 'pnpm' }
    - run: pnpm install --frozen-lockfile
    - run: pnpm tsc --noEmit
```

> Contracts-first rule (CLAUDE.md §Contracts-first): typecheck가 모든 job의 사전 조건.

### Job 2: lint

```yaml
lint:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v3
      with: { version: 9 }
    - uses: actions/setup-node@v4
      with: { node-version: '20', cache: 'pnpm' }
    - run: pnpm install --frozen-lockfile
    - run: pnpm lint
    - run: pnpm format --check
```

### Job 3: vitest

```yaml
vitest:
  runs-on: ubuntu-latest
  needs: [typecheck]
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v3
      with: { version: 9 }
    - uses: actions/setup-node@v4
      with: { node-version: '20', cache: 'pnpm' }
    - run: pnpm install --frozen-lockfile
    - run: pnpm vitest run --coverage
    - uses: actions/upload-artifact@v4
      with:
        name: coverage-report
        path: coverage/
```

### Job 4: playwright (Post-PR-1 활성화)

> Phase 0 PR-0 ~ PR-1 기간에는 비활성화. PR-1 머지 후 주석 해제.

```yaml
playwright:
  runs-on: ubuntu-latest
  needs: [typecheck, lint, vitest]
  # TODO: PR-1 머지 후 주석 해제
  # if: github.event_name == 'pull_request'
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v3
      with: { version: 9 }
    - uses: actions/setup-node@v4
      with: { node-version: '20', cache: 'pnpm' }
    - run: pnpm install --frozen-lockfile
    - run: pnpm playwright install --with-deps chromium
    - run: pnpm playwright test
      env:
        NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
    - uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: playwright-report
        path: playwright-report/
```

---

## 2. Branch Protection 규칙

### main 브랜치 보호 설정 (GitHub → Settings → Branches)

| 항목 | 설정값 |
|---|---|
| Require a pull request before merging | ON |
| Require approvals | 1명 이상 |
| Dismiss stale pull request approvals when new commits are pushed | ON |
| Require status checks to pass before merging | ON |
| Required status checks | `typecheck`, `lint`, `vitest` |
| Require branches to be up to date before merging | ON |
| Restrict who can push to matching branches | Admin only |
| Allow force pushes | OFF |
| Allow deletions | OFF |

### 브랜치 네이밍 규칙 (CLAUDE.md §Git Conventions)

```
feature/<짧은-설명>   예: feature/add-hapcard-streaming
fix/<짧은-설명>       예: fix/prevent-score-overflow
refactor/<설명>       예: refactor/extract-scoring-engine
chore/<설명>          예: chore/upgrade-nextjs-15-3
```

---

## 3. Vercel 프로젝트 연결 절차

### 최초 설정 (1회)

1. Vercel 대시보드 → "Add New Project"
2. GitHub 레포지토리 import
3. Framework Preset: **Next.js** (자동 감지)
4. Root Directory: `.` (모노레포 구조 시 `apps/web` 등으로 변경)
5. Build Command: `pnpm build`
6. Output Directory: `.next` (자동)
7. Install Command: `pnpm install --frozen-lockfile`
8. 환경변수 등록 (`docs/specs/secrets.md` §3 참조)

### 배포 트리거

| 이벤트 | 배포 환경 | 비고 |
|---|---|---|
| `main` 브랜치 push | Production | 자동 배포 |
| PR 오픈/업데이트 | Preview | PR별 고유 URL 생성 |
| `vercel --force` CLI | Production | 수동 강제 배포 |

### Preview URL 활용

- PR마다 `https://<project>-<hash>.vercel.app` 형태 고유 URL 생성
- QA 스킬(`/qa`, `/browse`) 실행 시 이 URL 사용
- CLAUDE.md §10 검증 스킬 매핑 참조

---

## 4. Bubblewrap TWA 빌드 (Phase 0 G5+)

> TWA(Trusted Web Activity) 빌드는 Phase 0 G5 게이트(출시 직전) 이후 활성화.
> 사전 조건: `BUBBLEWRAP_KEYSTORE_PATH`, `BUBBLEWRAP_KEYSTORE_PASSWORD` 등록 완료.

### 로컬 빌드 절차

```bash
# Bubblewrap CLI 설치 (1회)
npm install -g @bubblewrap/cli

# TWA 프로젝트 초기화 (1회)
bubblewrap init --manifest https://<production-domain>/manifest.json

# APK 빌드
bubblewrap build

# APK 서명 검증
jarsigner -verify -verbose -certs app-release-signed.apk
```

### GitHub Actions TWA 빌드 Job (G5+ 활성화)

```yaml
twa-build:
  runs-on: ubuntu-latest
  if: startsWith(github.ref, 'refs/tags/v')  # 태그 push 시에만
  needs: [typecheck, lint, vitest, playwright]
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: '20' }
    - run: npm install -g @bubblewrap/cli
    - run: bubblewrap build
      env:
        KEYSTORE_PATH: ${{ secrets.BUBBLEWRAP_KEYSTORE_PATH }}
        KEYSTORE_PASSWORD: ${{ secrets.BUBBLEWRAP_KEYSTORE_PASSWORD }}
    - uses: actions/upload-artifact@v4
      with:
        name: twa-apk
        path: app-release-signed.apk
```

### Digital Asset Links 설정

`public/.well-known/assetlinks.json` 파일 필요:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.hap.saju",
    "sha256_cert_fingerprints": ["<keystore SHA-256>"]
  }
}]
```

---

## 5. 배포 후 검증 SOP

1. Vercel 배포 완료 확인 (대시보드 또는 CLI)
2. `/canary` 스킬 실행 — 에러율, 응답시간 5분 모니터링
3. `/benchmark` 스킬 실행 — Lighthouse 회귀 확인
4. 이상 감지 시 Vercel → "Rollback to previous deployment"
5. CLAUDE.md §10 검증 스킬 매핑 참조

# Apps-in-Toss 구현 레퍼런스 — 오늘케미(todaychemi)

> **빌드 바이블 (build-bible).** 본 문서는 `apps_in_toss_launch_goal_prompt.md`(런치 목표·의사결정 프롬프트)의 동반 문서이며, 검증된 SDK 동작/시그니처/문서 인용을 한 곳에 모은 구현 레퍼런스다. 8개 리서치 블록(공식 Apps-in-Toss 개발자 문서 6 + 기존 코드베이스 2)을 단일 출처로 통합했다.

---

## 0. 목적 + 사용법

### 0.1 목적
- `apps_in_toss_launch_goal_prompt.md` 는 **무엇을 결정해야 하는가**(런치 §5 의사결정 매트릭스 D1~D6)를 다룬다.
- 본 문서는 **어떻게 구현하는가**(검증된 SDK 메커닉 + 정확한 시그니처 + 코드베이스 통합 지점)를 다룬다.
- 모든 사실은 공식 문서 id + URL 로 grounding 되어 있다. 문서에 없는 사실은 **NOT FOUND in docs** 로 명시했다. 추측 금지(§1.1).

### 0.2 사용법
1. 구현 작업 진입 전 해당 섹션을 읽는다 (§1 셸 / §2 로그인 / §3 mTLS / §4 IAP / §5 공유·라이프사이클 / §6 검수·정책).
2. 코드 통합 시 §7(코드베이스 통합 맵)에서 파일 참조와 재사용 지점을 확인한다.
3. 결정이 바뀌면 §8(결정 의존 지점)에서 영향 범위를 추적한다.
4. 미확인 사실은 §9(NOT-FOUND)에서 채널톡 확인 대상으로 관리한다.
5. 이 문서는 **CLAUDE.md §1.1 비협상 결정 대기 항목**을 다수 포함한다 (계정 모델·TDS 채택 깊이·결제 채널 분리 등). 임의 가정 없이 사용자 승인 후 진행.

### 0.3 문서 기준일 / 채널 컨텍스트
- 기준일: 2026-06-14.
- 채널: 오늘케미는 **Vite SPA / WebView 미니앱** (`@apps-in-toss/web-framework`) 으로 런치. 기존 Next.js 16 + Supabase + Vercel 백엔드는 서버 API 로 재사용.
- 문서에 RN(`@apps-in-toss/framework` / `@granite-js/react-native`) 예제만 있는 경우 inline 플래그 표기. **웹 채널은 항상 `@apps-in-toss/web-framework`.**

---

## 1. 빌드 체인 & 셸

### 1.1 프레임워크 선택 + 치명적 버전 분기 (DECISION FLAG)

미니앱 프런트 채널은 **WebView SDK** (`@apps-in-toss/web-framework`) 사용. WebView/React Native SDK 는 `Granite` 공통 런타임 공유.
- 출처: doc `02a4c22cd6c587b9` — https://developers-apps-in-toss.toss.im/bedrock/intro.md
- "기존 웹 서비스를 토스 앱에서 빠르게 실행할 수 있어요."

**iframe 금지** (검수 반려 + 기능 깨짐). 유일 예외: YouTube 비디오 임베드. (doc `02a4c22cd6c587b9`, `472fad8667ab71b3`)

#### ⚠️ DECISION FLAG — SDK 2.x(`granite.config.ts`) vs SDK 3.x(beta)(`apps-in-toss.config.ts`)
문서는 **두 개의 호환 안 되는 config 규약**을 기술한다. 시드/튜토리얼 문서는 2.x. 3.x(현재 `@beta`)는 config 파일명과 여러 필드를 rename 한다. 함수/피처 인터페이스는 "2.x.x와 100% 동일". **셸 작성 전 어느 라인을 타깃할지 제품 결정 필요.**

| 항목 | 2.x (`granite.config.ts`) | 3.x (`apps-in-toss.config.ts`) |
|---|---|---|
| config 파일명 | `granite.config.ts` | `apps-in-toss.config.ts` |
| `brand` | `displayName`, `primaryColor`, `icon` | `primaryColor` only |
| WebView props 키 | `webViewProps` (has `type`) | `webView` (no `type`) |
| 출력 디렉토리 필드 | `outdir` | `webBundleDir` |
| `web` 블록 (`web.host/port/commands`) | config 파일 내 | 제거 → `package.json` scripts 이동 |
| 빌드 호출 | `vite build` | `vite build && ait build` |
| 설치 | `@apps-in-toss/web-framework` (latest) | `@apps-in-toss/web-framework@beta` |
| TDS (사용 시) | `@toss/tds-mobile` + `@toss/tds-mobile-ait` (`@emotion/react@^11`/`react@^18` peers) | 둘 다 `2.4.1` 핀 |

자동 마이그레이션: `npx ait migrate v3` (yarn/pnpm 동일).
- 출처: doc `0ce584f10db25f34` — https://developers-apps-in-toss.toss.im/bedrock/reference/framework/시작하기/SDK3.0.md

> **본 §1 의 나머지는 SDK 2.x(`granite.config.ts`) 경로를 문서화한다** — 모든 install/sandbox/build/deploy 문서가 현재 2.x 를 보여주기 때문. 3.x 차이는 inline 표기.

### 1.2 설치 + init 커맨드

#### A. 기존 웹 프로젝트 경로 (오늘케미 재사용 시나리오 — 권장)
```sh
npm install @apps-in-toss/web-framework
npx ait init
```
(pnpm: `pnpm add @apps-in-toss/web-framework` + `pnpm ait init`)
`ait init` 이 `granite.config.ts` 자동 생성. (doc `38ca80ed3b775d6c` — https://developers-apps-in-toss.toss.im/tutorials/webview.md)

#### B. 신규 프로젝트 경로 (greenfield)
```sh
npx create-ait-app {appName}
```
`{appName}` 은 콘솔 등록 appName 과 일치해야 함. 인터랙티브 프롬프트: TDS 사용(Y/N), AI skills 추가, 예제 코드(인앱 결제/광고). (doc `1eec3e1adf4bb765` — https://developers-apps-in-toss.toss.im/tutorials/ai-vibe-coding.md)

#### C. 선택 AI 툴체인 (`ax` CLI/MCP) — 빌드 필수 아님
- macOS: `brew tap toss/tap && brew install ax`
- Windows: `scoop bucket add toss https://github.com/toss/scoop-bucket.git` → `scoop install ax`
- repo: `https://github.com/toss/apps-in-toss-ax` (doc `1eec3e1adf4bb765`)

#### 전제: 콘솔 앱 등록
앱은 콘솔에 먼저 등록. 승인 보통 **영업일 1~2일**. config 의 `appName` 은 콘솔 등록 앱과 정확히 일치. (doc `1eec3e1adf4bb765`, `38ca80ed3b775d6c`)
- ⚠️ DECISION FLAG: 수익화 기능·토스 로그인은 **사업자 등록 없이 불가**. (doc `d990b2480c0b106f` — https://developers-apps-in-toss.toss.im/prepare/console-workspace.md)

### 1.3 `granite.config.ts` 스키마 (SDK 2.x WebView)

`defineConfig` 은 `@apps-in-toss/web-framework/config` 에서 import.

```ts
import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'todaychemi',           // 콘솔 appName — 고유 식별 키 (등록 후 수정 불가)
  brand: {
    displayName: '오늘케미',        // 콘솔 등록 표시명
    primaryColor: '#FF91D5',       // 앱 주 색상 (버튼 등 적용)
    icon: '',                      // 콘솔 업로드 아이콘 URL
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'vite dev',
      build: 'vite build',
    },
  },
  permissions: [],                 // 오늘케미: 카메라/위치 미사용 → 빈 배열
  outdir: 'dist',
  webViewProps: { /* §1.3 C — 선택 */ },
});
```
- 출처: doc `38ca80ed3b775d6c`, `1eec3e1adf4bb765`

#### A. 필드 의미
- `appName` — **앱별 고유 식별 키**. 딥링크 경로 `intoss://{appName}`, 테스트/배포에 사용. **등록 후 수정 불가** ("appName은 한 번 등록 후 수정할 수 없으니 신중하게", doc `d990b2480c0b106f`). 샌드박스 접근 = `intoss://{appName}`; 콘솔 QR 테스트 = `intoss-private://{appName}`.
- `brand.displayName`/`primaryColor`/`icon` — 콘솔 등록 정보와 일치.
- `web.host`/`web.port` — 개발 서버 호스트/포트 (기본 `localhost:5173`). 실기기 테스트 시 LAN IP + `--host` (§1.5 B).
- `web.commands.dev`/`build` — Granite 가 호출하는 실제 번들러 커맨드. 빌드 변형 `tsc -b && vite build` 도 문서에 존재 (doc `797bd8d6a67c7876`).
- `outdir` — 빌드 출력 디렉토리 (`'dist'`).
- `permissions` — 선언 네이티브 권한 (검수 시 사용).
- `webViewProps` — WebView 동작 오버라이드.

> NOTE: WebView 2.x config 전용 필드별 `defineConfig` 레퍼런스 페이지는 **NOT FOUND in docs** (vibe-coding 문서 링크 `.../UI/Config.html` 미회수). 위 필드는 읽은 문서 전체의 합집합.

#### B. `permissions` — 전체 권한 목록 + access 의미
`permissions: [{ name, access }]`. 검수 시 사용. WebView 환경은 표준 브라우저 Web API 를 제한하지 않음.

| name | access | API |
|---|---|---|
| `camera` | `access` | openCamera |
| `photos` | `read` | fetchAlbumPhotos |
| `clipboard` | `read`, `write` | getClipboardText / setClipboardText |
| `contacts` | `read` | fetchContacts |
| `geolocation` | `access` | startUpdateLocation, getCurrentLocation, useGeolocation |
| `microphone` | `access` | "추후 지원될 예정" — 미지원; WebView 는 Web API 로 구현 |

- 출처: doc `f50b386920d0811c` — https://developers-apps-in-toss.toss.im/bedrock/reference/framework/권한/permission.md ; cross-ref `e4e52bc3f13ea6ab`.
- **오늘케미: `permissions: []`** (카메라/위치 등 미사용 예상).

#### C. `webViewProps` (선택) — WebView 동작
- `allowsInlineMediaPlayback` (boolean, 기본 `false`, iOS)
- `bounces` (boolean, 기본 `true`, iOS)
- `pullToRefreshEnabled` (boolean, 기본 `true`, iOS; `true` 시 `bounces:true` 강제)
- `overScrollMode` (`'never'|'always'|'auto'`, 기본 `'always'`, Android)
- `mediaPlaybackRequiresUserAction` (boolean, 기본 `true`, iOS+Android; Android ≥ v17)
- `allowsBackForwardNavigationGestures` (boolean, 기본 `true`, iOS)
- WebView props 는 **config(빌드) 시점에 적용**, 런타임 아님. (doc `a1731ebb474436af` — https://developers-apps-in-toss.toss.im/bedrock/reference/framework/속성)

**핀치 줌 비활성화 필수** (검수 반려 리스크) — config 필드 아님, index.html meta 태그:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
```
(doc `a1731ebb474436af`)

#### D. `AppsInToss.registerApp` (RN 시그니처만 문서화)
`AppsInToss.registerApp(AppContainer, { appName, context, router })` — 파일 기반 라우팅 등 제공. 문서의 시그니처/예제는 `@apps-in-toss/framework` + `@granite-js/react-native` (RN). **WebView 전용 `registerApp` 셸 시그니처는 NOT FOUND in docs** — WebView 경로는 `granite.config.ts` + 번들러로 셸을 구동. (doc `02a4c22cd6c587b9`)

### 1.4 빌드 커맨드 → `.ait` 번들
```sh
npm run build      # (pnpm build / yarn build)
```
- `.ait` 확장자 앱 번들 생성. **프로젝트 루트**에 `<서비스명>.ait` (서비스명 = appName).
- "빌드가 완료되면 프로젝트 루트 디렉토리에 `<서비스명>.ait` 파일이 생성돼요." (doc `e6fd6d2b697f7860` — https://developers-apps-in-toss.toss.im/development/test/toss.md)
- 3.x 주의: 빌드는 `vite build && ait build` (`ait build` 가 번들 생성). (doc `0ce584f10db25f34`)
- 업로드 실패 원인: `npm run build` 산출이 아니거나 구조가 잘못되면 `.ait` 컴파일 실패 → 업로드 거부.

### 1.5 개발 / 샌드박스 실행 + 스킴 의미

#### 스킴 의미 (load-bearing)
| 스킴 | 사용 가능 시점 | 용도 |
|---|---|---|
| `intoss://{appName}` | **정식 출시 이후만** | 프로덕션 / 샌드박스앱 접근 |
| `intoss-private://{appName}` (또는 `intoss-private://appsintoss?_deploymentId=…`) | 출시 전 | 콘솔 QR 테스트 |
- `intoss://` 는 출시 후 전용. 출시 전 테스트는 **반드시** 테스트 스킴(QR). (doc `e6fd6d2b697f7860`, `38ca80ed3b775d6c`)

#### A. 샌드박스 앱 (로컬 dev/QA)
별도 dev 토스앱 없음 → 전용 **샌드박스 앱** 사용. 흐름: env 설정 → 샌드박스 앱 설치 → 로그인 → 앱 선택 → 스킴(URL) 입력. 로그인 = 개인 토스 비즈니스 계정. 실행: `intoss://{appName}` → "스키마 열기". (doc `797bd8d6a67c7876` — https://developers-apps-in-toss.toss.im/development/test/sandbox.md)

#### B. 실기기 dev 서버 접근
```ts
web: { host: '192.168.0.100', port: 5173,
  commands: { dev: 'vite --host', build: 'vite build' } }
```
- iOS: 동일 Wi-Fi + "로컬 네트워크" 권한; IP = `ipconfig getifaddr en0`; "Bundling {n}%..." = 연결.
- Android: `adb reverse tcp:8081 tcp:8081` + `adb reverse tcp:5173 tcp:5173` (8081 = 샌드박스 내부 포트, PC 웹은 8081 Not Found 정상). (doc `38ca80ed3b775d6c`, `797bd8d6a67c7876`)

#### C. 디버깅
- Android: `chrome://inspect/#devices` → WebView inspect (USB 디버깅 필요).
- iOS: Safari → 개발자용 → 기기 → 앱 → URL.

#### D. 샌드박스 피처 지원 매트릭스 (테스트 계획 영향)
| 피처 | 샌드박스 |
|---|---|
| 토스 로그인 | ✅ |
| 사용자 식별키 (user_key) | ✅ (**mock 데이터** 반환) |
| 토스 페이 | ✅ |
| 인앱 결제 (IAP) | ✅ |
| 게임 프로필/리더보드 | ✅ |
| 분석 (Analytics) | ❌ |
| 공유 리워드 | ❌ |
| 인앱 광고 | ❌ |
| 가로 게임 / 네비바 공유 | ❌ |
- 출처: doc `797bd8d6a67c7876`
- ⚠️ 오늘케미: **`user_key` 가 샌드박스에서 mock** → Analytics/공유리워드 미지원 → 해당 플로우는 콘솔 QR(토스앱) 테스트로 검증.

#### E. 토스앱 QR 최종 테스트 (검수 게이트)
1. `.ait` 빌드 → 콘솔 업로드 (또는 CI/CD §1.7).
2. 콘솔 "앱 출시" → "테스트하기" → QR. 조건: 토스앱 로그인 + 워크스페이스 멤버 + **만 19세 이상**.
3. 또는 테스트 스킴 직접: `intoss-private://appsintoss?_deploymentId={uuid}` (업로드마다 새 `deploymentId`, `_deploymentId` **필수**). 경로: `intoss-private://appsintoss/path/...?_deploymentId=…`; `queryParams` 는 **URL-encoding 필수**.
4. **검토 요청 전 최소 1회 테스트 완료 필수.** (doc `e6fd6d2b697f7860`)

### 1.6 번들 100MB 규칙 + 리소스 분리
- 앱 번들: **압축 해제 기준 100MB 이하**. 모든 리소스 포함.
- **리소스 파일은 빌드에서 분리** → 외부 스토리지/CDN. 단계/지연 로딩 적용 (iOS 메모리 한계 → 번들 과중 시 white-screen).
- 오늘케미: Vite SPA 번들은 작음 + LLM/사주 콘텐츠는 서버 렌더 → 바인딩 가능성 낮음. 이미지/폰트는 CDN/원격 유지. (doc `8971d4b432ecb114`, `e6fd6d2b697f7860`)

### 1.7 CI/CD 자동 업로드 (`ait deploy`)
**SDK ≥ v1.4.0 필요.** 콘솔에서 API 키 발급 (워크스페이스 → 키).
```sh
npx ait deploy --api-key {API 키}
# 또는 토큰 등록 후:
npx ait token add
npx ait deploy
npx ait deploy -m "출시메모"
```
| 커맨드 | 용도 |
|---|---|
| `npx ait token add [워크스페이스명] [API 키]` | 토큰 등록 |
| `npx ait token remove [워크스페이스명]` | 토큰 제거 |
| `npx ait deploy [워크스페이스명] [API 키]` | 번들 업로드 |
- 성공 업로드는 테스트 앱-스킴 반환. **`ait deploy` 가 검수 자동제출/자동출시하는지는 문서에 없음** — 검수/출시는 콘솔 액션. (doc `e6fd6d2b697f7860`)

### 1.8 출시 / 배포 흐름 + 롤백
흐름: 콘솔 업로드/CI → ≥1 토스앱 테스트 → 검토 요청 → 승인(이메일) → 출시하기.
- 검토 요청 버튼은 **≥1 테스트 완료 후** 활성. **한 번에 한 버전.** 검수 **최대 영업일 3일**.
- 버그 수정: "요청 취소하기" → 새 `.ait` 업로드 → 재요청. 반려: "반려사유 보기" → 수정 → 재업로드.
- 출시: 승인 후 "출시하기" → **전 사용자 즉시 반영**.
- 롤백: 콘솔 "앱 출시" 의 이전 버전 선택 → "출시하기" → **전 사용자 즉시 반영**.
- **점진적/퍼센트/카나리 롤아웃 메커니즘 NOT FOUND in docs** — 출시·롤백 모두 all-users-immediate. → 플랫폼에 카나리 레버 없음 (CLAUDE.md 의 ADR-008 5% 카나리는 LLM 프롬프트 한정, 번들 출시와 무관).
- 사후 검수 지속 → 정책/법령 위반 시 긴급 운영 중단. 모니터링: Sentry (`/learn-more/sentry-monitoring.md`). (doc `8971d4b432ecb114`)

### 1.9 지원 OS 하한 + CORS 도메인 (셸 관련)
| OS | 최소 |
|---|---|
| Android | **Android 7** |
| iOS | **iOS 16** |
- (doc `797bd8d6a67c7876`. 토스앱 피처별 버전 하한은 §4/§5 의 per-API 게이트.)

CORS Origin allowlist (Supabase + Next.js API) — **둘 다 등록 필수**:
- 프로덕션: `https://<appName>.apps.tossmini.com`
- QR/테스트: `https://<appName>.private-apps.tossmini.com`
- (doc `8971d4b432ecb114`, `e6fd6d2b697f7860`. 상세 §7.)

---

## 2. 토스 로그인

> Base URL (로그인 + 토큰교환 + disconnect): `https://apps-in-toss-api.toss.im`. **모든 로그인 API mTLS 필수** (§3). (doc `7bfd7becd29c506e` — https://developers-apps-in-toss.toss.im/login/develop.md)

### 2.1 콘솔 전제 (코드 동작 전 필수)
출처: doc `6b96a54d7cb23c6b` — https://developers-apps-in-toss.toss.im/login/intro.md
1. **약관 동의** — **대표 관리자(primary admin)** 계정만 가능. 콘솔 → '토스 로그인' → '약관 확인하기'.
2. **설정하기**:
   - ① 연동할 서비스 (greenfield 오늘케미 비해당)
   - ② 동의 항목(scopes): `USER_NAME`/`USER_EMAIL`(null 가능)/`USER_GENDER`/`USER_BIRTHDAY`/`USER_NATIONALITY`/`USER_PHONE`/`USER_CI`
   - ③ 약관 등록 (필수 약관 자동 포함 + 파트너 약관 URL 추가)
   - ④ **연결 끊기 콜백 정보** — **이름/이메일/성별 외 항목 선택 시 반드시 입력**: 콜백 URL, HTTP method(`GET`/`POST`), Basic Auth 헤더.
3. **복호화 키 확인** — '이메일로 복호화 키 받기' → 시크릿 매니저 저장. 재발급은 채널톡.

> **DECISION FLAG (D-SCOPE-1):** 오늘케미는 사주 계산에 **생일 + 출생시각 + 성별** 필요. `USER_BIRTHDAY`/`USER_GENDER` scope 요청 시 → **연결 끊기 콜백(§2.6) 필수** (성별은 콜백 불요지만 생일은 필요). `USER_BIRTHDAY` 는 `yyyyMMdd` 만 반환(시각 없음) → **출생 시각은 앱 자체 입력 폼 필요**.

### 2.2 클라이언트 — `appLogin()` (미니앱 SPA 전용)
출처: doc `d6864a6452318d80` + `7bfd7becd29c506e` §1
```typescript
function appLogin(): Promise<{
  authorizationCode: string;
  referrer: 'DEFAULT' | 'SANDBOX';
}>;
```
- import (웹): `import { appLogin } from '@apps-in-toss/web-framework';`
- 클라이언트는 **코드 획득만** 수행. 토큰 교환/유저 조회는 **반드시 서버**.
- **`authorizationCode` 유효 10분, 일회성** ("재사용하면 실패"). 클라이언트에 장기 저장 금지, AccessToken/RefreshToken 클라이언트 저장 금지.
- `authorizationCode` + `referrer` **둘 다** 서버로 전달 (토큰 교환에 `referrer` 필요).
- 예제 repo: `with-app-login`.

### 2.3 서버 1 — 토큰 교환 (`generate-token`)
출처: doc `7bfd7becd29c506e` §2. **mTLS 필수.**
- `POST /api-partner/v1/apps-in-toss/user/oauth2/generate-token` (`application/json`)
- 전체 URL: `https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/user/oauth2/generate-token`

**요청 body**: `authorizationCode`(Y), `referrer`(Y).

**성공 응답** (`success`): `tokenType`(고정 `bearer`, 샘플 `"Bearer"`), `accessToken`(JWT RS256, `iss: https://cert.toss.im`), `refreshToken`, `expiresIn`(초, 샘플 `3599`), `scope`(공백 구분).
- **AccessToken 유효 1시간.**

**실패** (만료/재사용 코드): `{ "error": "invalid_grant" }` (bare shape — `resultType` 봉투 아님) 또는 `{ "resultType": "FAIL", "error": { "errorCode": "INTERNAL_ERROR", ... } }`. **파서가 두 shape 모두 처리.**

### 2.4 서버 2 — 토큰 갱신 (`refresh-token`)
출처: doc `7bfd7becd29c506e` §3. **mTLS 필수.**
- `POST /api-partner/v1/apps-in-toss/user/oauth2/refresh-token` (`application/json`)
- body: `refreshToken`(Y). 성공 응답 = generate-token 동일 shape.
- 실패: `errorCode` + `reason`.
- **RefreshToken 유효 14일.** AccessToken(1h) << RefreshToken(14d). 14d 후 `appLogin()` 재실행.

### 2.5 서버 3 — 유저 정보 (`login-me`) + userKey + PII
출처: doc `7bfd7becd29c506e` §4. **mTLS 필수.**
- `GET /api-partner/v1/apps-in-toss/user/oauth2/login-me` (`application/json`)
- header: `Authorization: Bearer ${AccessToken}`

**성공 응답** (`success`):
| 필드 | 타입 | 암호화 | 비고 |
|---|---|---|---|
| `userKey` | number | N | **앱 스코프 고유 식별자** (앱마다 다름). canonical 신원. |
| `scope` | string | N | 동의된 scope + `user_key`. 샘플 콤마 구분. |
| `agreedTerms` | list | N | 동의 약관 태그 |
| `name`/`phone`/`birthday`(`yyyyMMdd`)/`ci`/`gender`(`MALE`/`FEMALE`)/`nationality`(`LOCAL`/`FOREIGNER`)/`email` | string | **Y (AES-256-GCM)** | PII |
| `di` | string | Y | **항상 `null`** |

- **모든 PII 는 AES-256-GCM 암호화**. `userKey`/`scope`/`agreedTerms` 는 비암호화.
- **2026-01-02 부터 `scope` 값에 `user_key` 추가** → 미지 scope 값을 throw 없이 처리.
- **scope 구분자 불일치**: generate-token 샘플은 공백, login-me 샘플은 콤마 → 콤마+공백 모두 split 하는 tolerant splitter.

**서버 에러코드**: `INTERNAL_ERROR` / `USER_KEY_NOT_FOUND` / `USER_NOT_FOUND` / `BAD_REQUEST_RETRIEVE_CERT_RESULT_EXCEEDED_LIMIT`(이후 `/api/login/user/me/without-di` 가능하나 `di` null).

#### PII 복호화 (doc §5)
- **AES-256 GCM**, 256-bit. 복호화 키 + **AAD** 는 콘솔 이메일 전달 (PHP 샘플은 `add = "TOSS"` 리터럴이나 실제 AAD 는 이메일 값 사용 — **실제 AAD 값 발급 이메일에서 확인**).
- **IV/NONCE 는 ciphertext 앞에 prepend** (`IV_LENGTH = 12` bytes). Base64 decode 레이아웃: `[IV(12B)][ciphertext][GCM tag(16B)]`. GCM tag `16*8` bits.
- 샘플 = Kotlin/PHP/Java (**Node/TS 샘플 없음 → 포팅 필요**). Node: `crypto.createDecipheriv('aes-256-gcm', key, iv)` + `setAAD` + `setAuthTag`.

### 2.6 서버 발화 disconnect — 토큰 제거 API
출처: doc `7bfd7becd29c506e` §6. **mTLS 필수.**
- by accessToken: `POST /api-partner/v1/apps-in-toss/user/oauth2/access/remove-by-access-token` (header `Authorization: Bearer $access_token`, no body)
- by userKey: `POST /api-partner/v1/apps-in-toss/user/oauth2/access/remove-by-user-key` (header + body `{"userKey": <number>}`). 성공: `{ "resultType": "SUCCESS", "success": { "userKey": ... } }`.
  - **Caveat: userKey 에 AccessToken 다수 시 readTimeout(3초)** → **재시도 금지, 일정 시간 후 재시도.**
- **중요**: 서비스가 직접 disconnect API 호출 시 §2.7 콜백 **미발화**.

### 2.7 사용자 발화 disconnect/탈퇴 CALLBACK (Toss → 오늘케미 서버)
출처: doc `7bfd7becd29c506e` §7 + `6b96a54d7cb23c6b` ④
- 토스앱 내 사용자 disconnect/탈퇴 시 콜백. 콘솔에 URL+method+Basic Auth 등록 (§2.1 ④).
- **Inbound** — Toss Inbound IP allowlist (§3) 필요.
- **Basic Auth 검증**: 들어온 `Authorization: Basic ...` 를 base64 decode → 콘솔 등록값 비교 → 불일치 거부.

**페이로드 (콘솔에서 GET/POST 중 택1)** — 두 필드만: `userKey`, `referrer`:
```
GET  $callback_url?userKey=443731103&referrer=UNLINK
POST $callback_url   { "userKey": 443731103, "referrer": "UNLINK" }
```

**`referrer` 값** (disconnect 사유):
| referrer | 의미 | 파트너 처리 |
|---|---|---|
| `UNLINK` | 사용자 직접 연결 끊기 | **로그아웃 처리** |
| `WITHDRAWAL_TERMS` | 로그인 서비스 약관 동의 철회 | 후처리 |
| `WITHDRAWAL_TOSS` | 토스 회원 탈퇴 | 후처리 |

> 클라이언트 `appLogin()` 의 `referrer`(`DEFAULT`/`SANDBOX`)와 콜백 `referrer` 는 **별개 개념** — 혼동 금지.
- 처리: Toss 가 동의약관·로그인정보 삭제 → 파트너도 세션/토큰 정리, 재로그인 유도.
- **NOT FOUND in docs**: 콜백 응답 기대 status/body, 재시도 정책, 중복 콜백 여부. → 핸들러는 멱등 + 2xx 반환.
> **DECISION FLAG (D-CALLBACK-1):** `WITHDRAWAL_TOSS` vs `UNLINK` 시 user-owned `relations`/`hapcards`/`user_charts` 의 hard-delete vs soft-disable vs anonymize 결정 = 파트너/법무. 문서는 세션/토큰 정리만 의무화.

### 2.8 userKey → hash 마이그레이션 (오늘케미 비해당)
- `getUserKeyForGame()` 은 **비게임 미니앱에 `INVALID_CATEGORY`** 반환 → 오늘케미(비게임)는 hash 경로 미적용, **`userKey`** 표준화. (doc `d37c5d213f4afc7f`)

### 2.9 E2E 서버 시퀀스 (오늘케미)
1. 클라(SPA): `const { authorizationCode, referrer } = await appLogin();` → 백엔드 POST.
2. 백엔드→Toss(mTLS): `generate-token` → `{ accessToken(1h), refreshToken(14d), scope }`. `invalid_grant` 처리.
3. 백엔드→Toss(mTLS): `login-me` Bearer → `{ userKey, scope, encrypted PII }`.
4. 백엔드: emailed AES-256-GCM 키+AAD 로 필요 PII 복호화 (IV=앞 12B).
5. 백엔드: `userKey`(numeric, 앱 스코프)로 Supabase user upsert. (§7 매핑)
6. 토큰: 서버측 저장(클라이언트 금지). 1h 전 refresh, 14d 후 재 appLogin.
7. Disconnect inbound(§2.7): 콜백 URL + Basic Auth 검증 + `referrer` 분기 + 2xx.
8. (선택) 서버 disconnect(§2.6): §2.7 콜백 미발화.

> **DECISION FLAG (D-PII-1):** login-me PII(생일·성별)는 CLAUDE.md §5 가 LLM 전송 금지하는 데이터와 동일. 복호화/저장은 서버측 유지, **LLM 페이로드 진입 금지** (chart_core 파생만 흐름). Toss 동의 scope ↔ LLM ZDR 경계는 독립 레이어.

---

## 3. mTLS 서버 클라이언트 (`toss-mtls-client.ts`)

> 출처: DOC-A `834f175372a0c3f7` (overview) · DOC-B `472fad8667ab71b3` (integration-process) · DOC-C `7bfd7becd29c506e` (login)

### 3.1 왜 mTLS 필수인가
흐름: 파트너 서버 → 앱인토스 서버 → 토스 서버. 일반 HTTPS 는 서버만 인증, **mTLS 는 파트너 서버와 앱인토스 서버가 상호 인증**. 보장: 통신 구간 암호화 / 허용 서버만 호출 / 위·변조 방지. **mTLS 필수 기능**: 토스 로그인, 토스 페이, 인앱 결제, 기능성 푸시·알림, 프로모션(토스 포인트). (DOC-A, DOC-B)

### 3.2 인증서 발급 + 다중 인증서 회전
- **콘솔에서 발급** (CSR/CLI 흐름 없음): 콘솔 → 앱 → 좌측 **"mTLS 인증서"** 탭 → **"+ 발급받기"**.
- 발급 시 **인증서 파일 + 키 파일** (PEM) 다운로드. 안전 저장, **만료 전 재발급**.
- **만료 기간: NOT FOUND in docs** (재발급 필요만 명시).
- **무중단 교체**: 콘솔 **다중 인증서 관리** 기능으로 **둘 이상 등록**. 실무 해석: 신규 cert 콘솔 등록(구 cert 유효 유지) → Vercel env 신규 PEM 배포 → 구 cert 만료. **정확한 overlap 시맨틱(동시 유효 창·revocation): NOT FOUND in docs.**

### 3.3 Vercel serverless 에서 cert/key 제시 (env PEM)
**문서 Node.js 예제 (verbatim — `toss-mtls-client.ts` 기반):**
```js
const https = require('https');
const fs = require('fs');
const options = {
  cert: fs.readFileSync('/path/to/client-cert.pem'),
  key: fs.readFileSync('/path/to/client-key.pem'),
  rejectUnauthorized: true,
};
const req = https.request('https://apps-in-toss-api.toss.im/endpoint', { method: 'GET', ...options }, (res) => { /* ... */ });
```
- client cert = `cert`(PEM) + `key`(PEM). `rejectUnauthorized: true` 유지.
- 문서는 **파일 읽기** 만 보여줌. **env PEM 패턴 NOT FOUND in docs** — 그러나 Node 의 `cert`/`key` 는 PEM `string`/`Buffer` 수용 → Vercel 은 `cert: process.env.TOSS_MTLS_CERT_PEM`, `key: process.env.TOSS_MTLS_KEY_PEM` 직접 공급 가능 (기능 동치, 인프라 결정).
- Kotlin 예제: 발급 파일 = **X.509 cert PEM + PKCS#8 private key PEM**, keystore 빈 password (`"".toCharArray()`) → 키 PEM 은 빈 passphrase 추정 (명시 X).
- **Vercel 주의**: PEM 은 env 저장(개행 `\n` 런타임 복원). mTLS 호출은 **서버 런타임(Route Handlers/server actions)에서만**, 브라우저 금지.
- **mandated TLS 버전/cipher/key 알고리즘: NOT FOUND in docs** (예제는 generic `TLS`, "경로·알고리즘·TLS 버전 환경별 조정").
- ⚠️ **인프라 리스크 (D-INFRA-1)**: 로그인 토큰교환+login-me+disconnect 는 mTLS client cert AND 정적 Outbound IP(`...192` 범위) 요구. Vercel serverless 는 둘 다 native 미제공 → **고정 egress mTLS proxy/gateway 또는 로그인 백엔드 Vercel 외부 이동 필요**.

### 3.4 방화벽 / IP allowlist + 포트
> ⚠️ DOC-A/DOC-B 가 같은 outbound 행을 다르게 라벨링 (DOC-A: "간편 로그인·메시지 발송·토스 포인트 지급" / DOC-B: "토스 로그인·스마트 발송·프로모션"). 같은 도메인·같은 IP, 문구만 차이.

**Outbound (가맹점 → 앱인토스)**:
| 기능 | 도메인 | Outbound IPs | 포트 |
|---|---|---|---|
| 토스 로그인 / 스마트 발송 / 프로모션 | `apps-in-toss-api.toss.im` | `117.52.3.192`, `211.115.96.192`, `106.249.5.192` | `443` |
| 토스 페이 | `pay-apps-in-toss-api.toss.im` | `117.52.3.195`, `211.115.96.195`, `106.249.5.195` | `443` |
- 모든 outbound = HTTPS 443.

**Inbound (앱인토스 → 가맹점)** — disconnect/결제 콜백 수신용 (DOC-A 전체 표; DOC-B inbound 표는 truncated/empty):
| IP | 포트 |
|---|---|
| `117.52.3.11` / `211.115.96.11` / `106.249.5.11` | `443` |
| `117.52.3.80~87` / `211.115.96.80~87` / `106.249.5.80~87` | `443` |
- **Vercel 함의**: Vercel egress 는 동적/공유 풀 → 파트너가 자기 outbound source IP 미제어 (allowlist 는 **목적지** IP 허용 목적). Inbound source-IP allowlisting 은 Vercel native 미지원 → **콜백 인증은 Basic Auth 헤더로** (§2.7).

### 3.5 Rate limit (QPM)
- **기본 3,000 QPM** (분당 쿼리) per 미니앱. 초과 시 일정 시간 차단.
- **차단 기간/HTTP status/`Retry-After`: NOT FOUND in docs.**
- 증액: **채널톡** (사용 목적·예상 트래픽·피크 요청량 제출). 대량은 **오픈 전 협의**.
- 별도 좁은 limit: 프로모션(토스 포인트)은 **userKey별 분당 최대 10회** (오늘케미 프로모션 사용 시만).

### 3.6 공통 응답 봉투 (`resultType`)
**모든 API 단일 봉투. `resultType` 먼저 검사.**
```json
{ "resultType": "SUCCESS", "success": { ... } }
{ "resultType": "FAIL", "error": { "errorCode": "INVALID_PARAMETER", "reason": "..." } }
```
- **봉투 예외**: 로그인 토큰교환/refresh 실패는 OAuth-style bare `{"error": "invalid_grant"}` → **두 shape 모두 처리.**
- **`resultType: FAIL` 동반 HTTP status: NOT FOUND in docs.**

### 3.7 Base URL 라우팅
| Base URL | 용도 | mTLS |
|---|---|---|
| `https://apps-in-toss-api.toss.im` | 토스 로그인·스마트 메시지·프로모션·**IAP** | Yes |
| `https://pay-apps-in-toss-api.toss.im` | 토스 페이 (간편 결제) | Yes |
- Out-of-scope(혼동 방지): `https://oauth2.cert.toss.im`·`https://cert.toss.im` = 본인확인/Toss Cert 스택 (Apps-in-Toss mTLS 경로 아님). 오늘케미가 본인확인 추가 시만 관련.

### 3.8 에러 / 타임아웃
- **`readTimeout = 3초`** = unlink-by-userKey 에만 명시. 발생 시 **즉시 재시도 금지, 후 재시도** (§2.6). 다른 엔드포인트 적용 여부 **NOT FOUND in docs**.
- Kotlin 예제 `connectTimeout/readTimeout = 5000` 은 client-side 예시값 (Toss mandated SLA 아님).
- **`ERR_NETWORK`** = mTLS 미적용 호출 → cert 누락/오류 증상 (서버 outage 아님).

### 3.9 `toss-mtls-client.ts` 체크리스트
1. 공유 `https.Agent` `{ cert, key, rejectUnauthorized: true }` (env PEM string).
2. base URL 2개 하드코딩 (§3.7). 로그인/IAP/메시지/프로모션 → `apps-in-toss-api`; 토스페이 → `pay-apps-in-toss-api`.
3. 기본 헤더 `Content-Type: application/json`; login-me/unlink-by-access-token 은 `Authorization: Bearer`.
4. 응답: JSON parse → top-level `error`(string) = OAuth 실패 → else `resultType` switch.
5. 타임아웃: unlink-by-userKey 3s readTimeout 시 auto-retry 금지.
6. 연결/`ERR_NETWORK` = cert 누락/무효로 취급.
7. 토큰 lifetime 캐싱(access 1h, refresh 14d)으로 3,000 QPM 여유 유지.
8. 회전: `TOSS_MTLS_CERT_PEM`/`_KEY_PEM` (+ 선택 `_NEXT`) swappable, 재배포 없이.

---

## 4. IAP (일회성 상품)

> 구독 IAP 는 범위 밖. 웹 채널 `import { IAP } from '@apps-in-toss/web-framework'`. 서버 order-status 는 mTLS. (doc `ee1fc55236c33bf9` develop, `a5efe3759b7291ba` reference)

### 4.1 Base URL + 패키지/버전
- SDK/IAP 서버 API base: `https://apps-in-toss-api.toss.im`. (토스 페이 base 는 IAP 미사용)
- `IAP` object: **토스앱 5.219.0 부터** 지원; 미지원 버전 `undefined`.
```typescript
IAP {
  getProductItemList; createOneTimePurchaseOrder; getPendingOrders;
  getCompletedOrRefundedOrders; completeProductGrant;
}
```

#### 피처별 최소 SDK/앱 버전 (verbatim)
| 피처 | 최소 SDK | 최소 토스앱 |
|---|---|---|
| 일회성 IAP 전체 | **SDK 1.1.3+** (상품 지급 완료 과정) | 5.219.0 |
| 구매 복원 | **SDK 1.2.2+** | — |
| `getPendingOrders` | — | Android 5.234.0 / iOS 5.231.0 (낮으면 `undefined`) |
| `getPendingOrders.orders[].sku` | **SDK 1.4.2** | as above |
| `getPendingOrders.orders[].paymentCompletedDate` | **SDK 1.4.8** | — |
| `completeProductGrant` | — | Android/iOS 5.231.0 (낮으면 `undefined`) |
| `getCompletedOrRefundedOrders` | — | Android/iOS 5.231.0 (낮으면 `undefined`) |
- 버전 게이팅: `getTossAppVersion(): string`, `isMinVersionSupported({android, ios})`.
- **마이그레이션 데드라인: 2026-03-23 이후 SDK 1.x 빌드 번들 콘솔 업로드 불가** → SDK 2.x 마이그레이션 필수 (RN 0.84 / React 19). **IAP 함수 시그니처가 2.x 에서 변경되는지 NOT FOUND in docs** — 위 IAP reference shape 가 권위.
- **WebView/Vite 채널 IAP 노출 최소 `@apps-in-toss/web-framework` 버전: NOT FOUND in docs** (1.1.3/1.2.2/1.4.2/1.4.8 feature gate + 토스앱 5.219.0 만 명시).

### 4.2 E2E 흐름
1. `getProductItemList` (상품 목록)
2. `createOneTimePurchaseOrder` (결제 요청)
3. `getPendingOrders` + `completeProductGrant` (미결 주문 복원)
4. `getCompletedOrRefundedOrders` 또는 서버 order-status API (주문 상태 조회)
- **기기 변경 간 지급 영속 필수**: 네이티브 Storage + 토스 로그인 + order-status API. **order-status/state-query API 는 사전 토스 로그인 연동 필수.**

### 4.3 EXACT 시그니처
#### `getProductItemList`
```typescript
function getProductItemList(): Promise<{ products: IapProductListItem[] } | undefined>;
interface IapProductListItem {
  sku: string; displayAmount: string; displayName: string; iconUrl: string; description: string;
}
```
#### `createOneTimePurchaseOrder`
```typescript
function createOneTimePurchaseOrder(params: IapCreateOneTimePurchaseOrderOptions): () => void; // cleanup 반환
interface IapCreateOneTimePurchaseOrderOptions {
  options: { sku: string; processProductGrant: (params: { orderId: string }) => boolean | Promise<boolean>; };
  onEvent: (event: SuccessEvent) => void | Promise<void>;
  onError: (error: unknown) => void | Promise<void>;
}
interface IapCreateOneTimePurchaseOrderResult {
  orderId: string; displayName: string; displayAmount: string; amount: number;
  currency: string; fraction: number; miniAppIconUrl: string | null;
}
interface SuccessEvent { type: 'success'; data: IapCreateOneTimePurchaseOrderResult; }
```
- IAP 결제 시트 오픈. 결제 중 에러 → 에러 유형별 에러 페이지 이동.
- 반환은 **cleanup `() => void`** — `onEvent`/`onError` 내 호출 + `window.addEventListener('pagehide', () => cleanup?.())`.
- **에러코드 enum / `onError` payload shape: NOT FOUND in docs** (reference 빈 섹션).

#### `getPendingOrders`
```typescript
function getPendingOrders(): Promise<{ orders: Order[] } | undefined>;
interface Order { orderId: string; sku?: string; paymentCompletedDate?: string; }
```
- 결제 완료 + 미지급 주문 (cleanup 없이 끝난 주문 포함). 최소 버전 미만 `undefined`.

#### `completeProductGrant`
```typescript
function completeProductGrant(params: { params: { orderId: string; }; }): Promise<boolean | undefined>;
```
- **이중 중첩 `params.params.orderId`** (verbatim). 호출: `IAP.completeProductGrant({ params: { orderId } })`. 지급 후 grant 완료 마킹.

#### `getCompletedOrRefundedOrders`
```typescript
function getCompletedOrRefundedOrders(params?: { key?: string | null; }): Promise<CompletedOrRefundedOrdersResult | undefined>;
interface CompletedOrRefundedOrdersResult {
  hasNext: boolean; nextKey?: string | null;
  orders: { orderId: string; sku: string; status: 'COMPLETED' | 'REFUNDED'; date: string; }[];
}
```
- COMPLETED + REFUNDED 반환 (paid-but-not-granted 제외 → `getPendingOrders`). **페이지당 최대 50**, `hasNext` 시 `nextKey` → 다음 `key`.

### 4.4 `processProductGrant` + 30초 지급 계약 + timeout 환불
- `processProductGrant: (params: { orderId: string }) => boolean | Promise<boolean>` — `orderId` 수신, 파트너 지급 로직 실행, `true`/`false` 반환.
- **30초 지급 창 (verbatim)**: "결제 성공 후 30초내에 `processProductGrant` 콜백이 호출되지 않거나 해당 콜백의 결과가 true가 아닌 경우, `{appName}에 문제가 생겼어요. 환불을 신청해주세요` 페이지가 노출될 수 있어요."
- SDK 1.1.3+ 부터 **파트너 지급 로직까지 성공해야 최종 성공**.
- **함의**: `processProductGrant` 내 grant(기존 Next.js 백엔드 라운드트립으로 오늘케미 피처 unlock+영속)는 30초 내 완료 + `true` 반환. 불가 시 → `getPendingOrders` + `completeProductGrant` 로 후속 복구.

#### 복구 흐름 (재실행 시)
1. `getPendingOrders()` → paid-but-not-granted `orderId` 목록.
2. 각 상품 서버측 unlock.
3. `completeProductGrant({ params: { orderId } })` → grant 완료.

### 4.5 서버 order-status API
출처: doc `a5efe3759b7291ba`. **사전 토스 로그인 연동 필수.** mTLS (§3).
- `POST /api-partner/v1/apps-in-toss/order/get-order-status` (`application/json`)
- header: `x-toss-user-key`(선택; 생략→전체 주문, 포함→해당 userKey 주문만)
- body: `orderId`(Y, **uuid v7**)

응답 (`success`): `orderId`, `sku`, `statusDeterminedAt`(`yyyy-MM-dd'T'HH:mm:ss`, **KST 고정**; REFUNDED 시 환불완료 시각), `status`(enum), `reason`.

**`status` enum (verbatim, 8값)**:
| status | 의미 | 상세 |
|---|---|---|
| `PURCHASED` | 주문 완료 | 결제+지급 완료 |
| `PAYMENT_COMPLETED` | 결제 완료 | SDK 1.1.3+ — paid 지급 실패 |
| `FAILED` | 주문 실패 | 결제 실패 |
| `REFUNDED` | 주문 환불됨 | 환불 완료 |
| `ORDER_IN_PROGRESS` | 주문 진행 중 | 생성됐으나 결제/지급 미완 |
| `NOT_FOUND` | 주문 없음 | orderId 없음 |
| `MINIAPP_MISMATCH` | 상품 불일치 | 이 앱 상품 아님 |
| `ERROR` | 내부 오류 | — |
- SKU 형식 관찰: `ait.0000010000.af647449....` (콘솔 표시 sku `sku1` 와 별개).

### 4.6 환불
출처: doc `a85a1ef35147e57a`
- IAP 환불 = **Apple/Google 정책**.
- **Android**: 사용자 토스앱 요청 → 콘솔 "환불 내역" → 파트너 승인/반려 가능하나 **최종 결정 = Google Play**.
- **iOS**: 전적 Apple 관리, 파트너 승인/반려 불가, order-status API 로 상태 조회만.
- 콘솔: 결제 내역/환불 내역/요청 승인/반려/완료. "지급완료" = 지급 완료, "결제 완료" = 미지급.
- **DECISION FLAG**: REFUNDED 시 오늘케미 백엔드는 de-grant/feature-lock 구현 (기존 `isFeatureUnlocked` 로 reconcile). **IAP 일회성 환불 webhook 계약 NOT FOUND in docs** (콘솔 결제 알림 URL 은 구독 상태변경용) → **poll 기반** (order-status API / `getCompletedOrRefundedOrders`).

### 4.7 콘솔 상품(SKU) 등록
출처: doc `a85a1ef35147e57a`
- 전제: 사업자 정보 → 정산 정보(검토 2~3 영업일) → 상품 등록.
- 상품 타입: **소모품(consumable)** / 비소모품 / 구독(범위 밖). 오늘케미 pay-per-use → **소모품(1회 이용권)**.
- **현금성·환가성·토스포인트 결합 상품 판매 금지** → **부적/talisman 을 현금성 토큰으로 판매 금지**, 피처 unlock 직접 판매.
- **상품 수 cap: 비게임 30 / 게임 80.**
- **공급가(VAT 제외) 400원 ~ 1,400,000원, 10원 단위.** 판매가 = 공급가 + VAT(자동). **2026-06-22 확정**: 오늘케미 IAP 판매가/공급가 = 케미카드 550/500, 또 다른 나 440/400, 케미 다시 맞추기 440/400, 인연 슬롯 550/500. 콘솔은 VAT 제외 공급가를 입력하고, `displayAmount`(`getProductItemList`)는 판매가 포맷을 표시한다.
- 수수료: 앱마켓 **15%** + 토스 **5%**.
- **샌드박스 노출**: `getProductItemList()` 는 콘솔 노출상태=ON 상품만 반환.

### 4.8 검수 필수 샌드박스 시나리오
샌드박스: 실결제 없음, 일회성 IAP 만 지원(구독 X). 환경 감지 `getOperationalEnvironment(): 'toss' | 'sandbox'`.

**3 필수 시나리오** (각 별도 실행):
1. **① 결제 성공**: `event.type: 'success'` → `event.data`(orderId/amount) → 내부 지급 → UI 업데이트.
2. **② 결제 성공 + 서버 지급 실패**: (a) 사용자 알림 (b) 재실행 시 `getPendingOrders` 복구 (c) 지급 후 `completeProductGrant`.
3. **③ 에러 테스트**: 네트워크 에러/취소/내부 에러/지급 실패 → 에러 UI/재시도.

검수 체크리스트:
| 항목 | 필수 |
|---|---|
| 상품 목록 노출 | ✔️ |
| 결제 성공 | ✔️ |
| 결제 성공 + 서버 지급 실패 (주문 복원) | ✔️ |
| 에러 테스트 | ✔️ |
| 주문 상태 조회 API | 권장 |
- Caveat: 샌드박스 통과 ≠ 승인 보장. `iframe` 금지(YouTube 제외).
- 예제 repo: `with-in-app-purchase`.

---

## 5. 공유 & 라이프사이클

> 웹 채널 `@apps-in-toss/web-framework`. RN 전용 API 는 inline 플래그.

### 5.1 `share()` — 네이티브 공유 시트
```typescript
function share(message: { message: string }): Promise<void>;
```
- (doc `114b4df88419e24e`) `import { share } from '@apps-in-toss/web-framework';`
- OS 네이티브 공유 시트. `message`(string) 만 전달. **title/url/files/image 필드 미지원** → OG 이미지는 `getTossShareLink` URL 로 임베드.
- 실패 시 throw (구조화 에러코드 **NOT FOUND in docs**).
- **`useVisibility` 무영향**: 시스템 공유 모달 열고닫기는 visibility 상태 미변경. (doc `340cf6eddf5d30f1`)

### 5.2 `getTossShareLink()` — 토스 공유 링크
```typescript
function getTossShareLink(url: string, ogImageUrl?: string): Promise<string>;
```
- (doc `ffcf28a2b1d62fcd`) `import { share, getTossShareLink } from '@apps-in-toss/web-framework';`
- 경로 → 토스앱 오픈 링크. 수신자 오픈 시 토스앱 실행 + 딥링크 화면 직행.
- **미설치 fallback**: iOS→App Store, Android→Play Store.
- `url`(1st) = **`intoss://` 딥링크**: `intoss://<앱이름>` 또는 `intoss://<앱이름>/about?name=test`.
- `ogImageUrl`(2nd, 선택) = SNS/메신저 OG 프리뷰. **반드시 `https://` 절대 경로.**
- **OG 캐시**: 외부 플랫폼 캐싱 → Kakao Debugger / Facebook Debugger 로 갱신.
- **canonical 패턴 (verbatim)**:
```js
const tossLink = await getTossShareLink('intoss://my-app', 'https://static.toss.im/.../icon.png');
await share({ message: tossLink });
```
> **DECISION FLAG (공유 UX)**: 오늘케미 "공유 케미카드 5종"(레이아웃별 OG)은 각 카드마다 별도 `intoss://` 딥링크 (예: `intoss://<appName>/hapcard/<id>?layout=...`) AND 별도 공개 `https://` OG URL. OG 는 **공개 auth-free https 엔드포인트** 필요 — 기존 hapcard OG 가 크롤러에 401 반환하는 설계와 충돌 → **공개 OG 엔드포인트 필요** (§5.6).

### 5.3 딥링크 — `intoss://` vs `intoss-private://`
- **`intoss://` 는 정식 출시 후만 접근.** 출시 전 = **`intoss-private://`** + `_deploymentId`(업로드마다 발급) **필수**:
  - `intoss-private://appsintoss?_deploymentId=0198c000-...`
  - sub-path: `intoss-private://appsintoss/path/pathpath?_deploymentId=...`
  - query: `...&queryParams=%7B...` — **queryParams URL-encoding 필수**.
- `scheme` config: `intoss` (RN 컨텍스트 `2ce949a797a31763`).
- **`openURL`** (doc `58f20f736c0379bb`): `function openURL(url: string): Promise<any>;` 웹 import 가능. `openURL('intoss://{appName}')`. RN `Linking.openURL` 내부 사용. 실패 시 reject.
- **`getSchemeUri`** (doc `a47b0dbb88a09cd4`): `function getSchemeUri(): string;` 화면 최초 진입 스킴 반환 (페이지 이동 URI 변경 미반영). cold-entry 딥링크 라우팅용. **단 doc 예제는 `@apps-in-toss/framework`(RN) → 웹 export 확인 NOT FOUND in docs** — 설치 타이핑 확인.

### 5.4 백버튼 & visibility 라이프사이클 (UX 검수 항목)
#### 백버튼 — 웹 채널: `graniteEvent.addEventListener('backEvent', …)`
(doc `ff9e688b1cfa78c3`)
```js
import { graniteEvent } from '@apps-in-toss/web-framework';
const unsubscription = graniteEvent.addEventListener('backEvent', {
  onEvent: () => { /* 기본 뒤로가기 차단됨; 자체 로직 */ },
  onError: (error) => { console.error(`에러: ${error}`); },
});
window.addEventListener('pagehide', () => { unsubscription(); });
```
- `onEvent` 시 **기본 뒤로가기 차단**. 화면 보이는 동안만 등록 (`useVisibility` gated).
- **언마운트 시 반드시 리스너 해제** + `onError` 항상 부착 (UX/leak 검수).
- 홈 버튼: 웹 = `graniteEvent.addEventListener('homeEvent', …)`. RN = `homeEvent.subscribe()`.
- **구분 (verbatim)**: `graniteEvent` = 네이티브 이벤트(뒤로가기 등), `appsInTossEvent` = 토스앱 내부 상태 변화. **`appsInTossEvent` 전체 surface + "앱 진입 완료 이벤트" 시그니처: NOT FOUND in docs.**
- RN 전용: `useBackEvent()` (`@granite-js/react-native`).

#### Visibility — `useVisibility` / `useVisibilityChange`
(doc `340cf6eddf5d30f1`)
- `function useVisibility(): boolean;` — 화면 가시 `true`/비가시 `false`. `false`: 다른 앱 전환/홈/다른 토스 인앱 서비스. `true`: 복귀. **시스템 공유 모달 무영향.**
- `function useVisibilityChange(callback): void;` — `'visible'`/`'hidden'` 전달. WebView 는 DOM `visibilitychange` 도 사용 가능.
- **웹 export 확인 NOT FOUND in docs** (예제 RN) — DOM `visibilitychange` fallback.
- iOS swipe-back: `setIosSwipeGestureEnabled({ isEnabled })`, `closeView()` (RN 컨텍스트, 웹 export 미확인).

### 5.5 네이티브 Storage SDK — 토큰/상태 영속
#### iOS 서드파티 쿠키 차단 (Storage 필요 이유)
(doc `18cbad6ad2b18fd5`) "iOS/iPadOS 13.4 이상에서는 **서드파티 쿠키가 완전히 차단**돼요. 앱인토스 도메인이 아닌 파트너사 도메인에서 **쿠키 기반 로그인**을 구현하면 정상 동작하지 않아요." → **토큰 기반 인증 적용.**
- **함의**: 서드파티 쿠키 의존 Supabase auth 는 iOS WebView 실패 → 네이티브 `Storage` SDK 토큰 기반 영속.

#### `Storage` SDK
(doc `855a5c640de107b9` 외) `import { Storage } from '@apps-in-toss/web-framework';`
```typescript
Storage: { getItem; setItem; removeItem; clearItems; }
function setItem(key: string, value: string): Promise<void>;
function getItem(key: string): Promise<string | null>;
function removeItem(key: string): Promise<void>;
function clearItems(): Promise<void>;
```
- 앱 재시작 후 유지. **string 값만** (JSON 직렬화 자체 수행).
- **`AsyncStorage` 사용 금지** ("화면이 하얗게 표시되는 white-out").
- **에러코드 / 값 크기 제한: NOT FOUND in docs.**
- **오늘케미 패턴**: Supabase access/refresh 토큰(또는 토스 로그인 파생 세션 토큰)을 `Storage.setItem` 영속, cold start 시 `Storage.getItem` 복원, logout 시 `removeItem`/`clearItems`.
- **미니앱은 토스 로그인만 사용** ("자사 로그인이나 다른 간편 로그인 사용 불가", doc `6b96a54d7cb23c6b`) — 기존 Supabase/Google 계정 모델과 충돌 (DECISION FLAG, §8).

### 5.6 OG 이미지 규칙 (공개 https 필수)
(doc `3b9251b28c237dbe` + `ffcf28a2b1d62fcd`)
- **이미지 크기 1200 × 600** (verbatim — 일반적 1200×630 과 다름). **DECISION/DESIGN FLAG**: 오늘케미 기존 OG 템플릿은 **1200×630** → 미니앱 채널용 **1200×600** 재생성.
- 고해상도, 민감/부적절 표현 금지, 썸네일 텍스트 과다 금지.
- `ogImageUrl` 은 `https://` 절대 경로. 위반 시 모니터링 시정/표시 제한.
- 캐시: Kakao/Facebook 디버거 갱신.
- **공개 접근 요구 (추론)**: OG 는 외부 크롤러/Toss 가 fetch 가능해야 함 = **공개 auth-free https 엔드포인트**. "OG 가 익명 크롤러에 200 반환 의무"는 **NOT FOUND in docs** 이나 메커니즘상 함의 → 현 401-to-crawler OG 설계와 load-bearing 충돌.

### 5.7 자사앱/외부웹 랜딩 금지 (공유 타깃 제약)
(doc `3a4727e22e4083fd`)
- **자사 앱 설치 유도 금지**: 설치 유도 문구/배너/이미지, **앱 마켓 링크**, 설치 혜택 전부 금지.
- **외부 링크 제한 허용**. **명시 금지 (이 슬라이스 직결)**: "**공유하기 기능의 링크가 자사 웹사이트로 랜딩되는 상태**" = 위반 → 공유 링크는 **`intoss://` 미니앱 딥링크로만** 해석, **`https://<오늘케미 자사 사이트>` 절대 금지**.
- 허용: 법률상 고지/필수 안내, 공공/제휴 공식 페이지, 비-자사 정보 확인, 일부 미완결 특수 케이스.
- **함의**: 공유는 항상 `getTossShareLink('intoss://<appName>/...')`. 핵심 피처(케미카드/또 다른 나 등)는 미니앱 내 완결. 법적 고지 페이지만 "법률상 고지" 허용 하 외부 링크 가능.

### 5.8 버전 게이트
- `isMinVersionSupported({ android, ios })` (doc `002d643c1135a4b7`):
```typescript
function isMinVersionSupported(minVersions: {
  android: `${number}.${number}.${number}` | 'always' | 'never';
  ios: `${number}.${number}.${number}` | 'always' | 'never';
}): boolean;
```
- 인접 참고: `contactsViral` 공유 리워드 = 토스앱 ≥5.223.0 + 미니앱 승인. `getAnonymousKey` = SDK ≥2.4.5, 비게임 전용, 게임=`'INVALID_CATEGORY'`, SDK 미만 `undefined`, 샌드박스 mock.

---

## 6. 검수/정책 DONE 바

> 비게임 미니앱 검수 체크리스트 + 정책. 출처: 서비스 오픈 정책 `081ffe8972e1c703`, 외부링크 가이드 `3a4727e22e4083fd`, UX 가이드 `b1cd33abe009994a`, 앱 내 기능 `6af044c79403a514`, 출시 `8971d4b432ecb114`, 콘솔 등록 `d990b2480c0b106f`.
> NOTE: `/checklist/app-nongame.md`(`ee88cf6dad963867`) + `/intro/caution.md`(`b9023e78a2d21798`) 는 **TOC stub** — 본문은 위 하위 페이지가 운반. 네비바 anchor(`#_4-내비게이션-바`)는 존재하나 렌더 본문 **NOT FOUND**.

### 6.1 출시 전 하드 게이트
**(a) 사업자 등록 — 로그인 AND 수익화 전제.** "사업자가 없으면 **수익화 기능 및 토스 로그인 사용 불가**." 인앱 광고·인앱 결제·토스페이·프로모션·비즈월렛·토스 로그인 모두 필요. 사업자 업종 = 미니앱 서비스 업종 일치 (불일치 시 출시 제한). 검토 영업일 1~2일. → **토스 로그인 + IAP 채널 = 사업자 등록 비스킵 게이트.**
**(b) 워크스페이스**: 사업자당 1개. `appName`(intoss 스킴 id) **등록 후 수정 불가**.
**(c) 연령**: **만 19세 이상** 제공 (플랫폼 레벨).

### 6.2 앱 내 기능 (앱 내 기능) — 비게임 최소 ≥1
(doc `6af044c79403a514`)
- "**비게임 앱은 앱 내 기능 최소 1개 이상 등록.**" 검토 영업일 1~2일. **검토 시점 URL 정상 접속 안 되면 반려.**
- 이름: 한국어 ≤10자 / 영어 ≤15자(첫글자만 대문자), 특수문자 `:`·`.` 만, 이모지 불가. UX = "~하기"/명사형 (일반 '보러가기' 반려).
- 딥링크 매핑(WebView): `intoss://{appName}/search`. index = `/`.
- **함의**: 케미/관계 해석 기능 드러내는 ≤10자 한국어 이름 + 라이브 URL (예: `intoss://todaychemi/feed`).

### 6.3 제한 서비스 카테고리 — 돈합 금융자문 플래그
(doc `081ffe8972e1c703` §1). 위반 → 앱정보/출시 단계 반려 + 운영 제한.

**출시 불가**: ① 디지털/가상자산(NFT) ② 자금세탁 가능성(현금/유사자산 교환·전환·환불) ③ 불법·부정행위 조장 ④ 사행성/복권/베팅 ⑤ **금융 상품 중개·판매·광고**(대출/보험/카드/증권 — 인허가 무관) ⑥ **투자 자문/리딩방/유료 정보**(종목 추천·투자 전략 안내) ⑦ 의료 ⑧ 기타 내부 정책 (브랜드 신뢰성/UX/리스크 재량 반려, 단순 홍보 목적 출시 불가).

> **돈합 RISK FLAG — 제품 결정 필요 (§1.1)**: 돈합은 **투자 자문/종목 추천/투자 전략**(⑥) 또는 **금융 상품 추천**(⑤)으로 제시 금지. 문서는 **운세/사주/궁합 자체를 제한 카테고리로 명시하지 않음** (NOT FOUND). 노출은 돈합 카피가 금융 의사결정 영향으로 넘어갈 때만. → 돈합 카피/LLM 출력은 관계/성향 케미("재물운 성향", 엔터테인먼트 프레이밍) 유지, 실행 가능 투자 조언 금지. 사주 제품은 §8 재량 반려권 + **사전 상담** 가능.

**남용 방지 (§3)**: 한 워크스페이스 내 "주제만 다르고 결과물만 다른 개별 미니앱" 금지 (예시: 'AI 여자 얼굴 만들기'/'AI 남자 얼굴 만들기'). → **6모드(일합/친구합/돈합/첫합/썸합/오래합)를 별도 미니앱 분리 금지, 한 앱 내 탑재.**

### 6.4 생성형 AI 고지 & 라벨링 — 법적 의무
(doc `081ffe8972e1c703` §5). 오늘케미 케미카드/만약합/오늘케미 LLM 출력은 범위 내.

**2 의무**:
1. **사전 고지**: 서비스 최초 이용 또는 생성형 AI 기능 최초 사용 시점에 AI 활용 사실 고지.
2. **표시 의무**: AI 생성 결과물임을 명확 인식 (**라벨/배지/워터마크 등 즉시 인식 가능 방식**).

**처벌**: **관련 법령에 따라 최대 3,000만 원 과태료** + 자료 제출/현장 조사/서비스 중지/시정명령. 사전 법률 검토 권장.
- **함의**: 오늘케미 기존 `AiDisclosureBadge`(케미카드/오늘케미/또 다른 나 hero) + `AiDisclosureNotice`(온보딩)가 사전 고지(최초 사용) + 표시 의무(결과별 배지) 충족. **Vite SPA 채널에 동일 컴포넌트/카피 이식 + 모든 AI 결과 표면(공유/OG 포함 AI 출력 렌더 시) 검증.**

### 6.5 로그인/결제/광고 정책 (신규 채널 하드 제약)
(doc `081ffe8972e1c703` §6; `6b96a54d7cb23c6b`)
- **로그인**: "미니앱 로그인은 **토스 로그인만**. 그 외 소셜/간편 로그인 불가." → **기존 Supabase(Google/email) auth 는 미니앱 내 로그인 불가.** 옵션: (a) 토스 로그인(사업자 필요) (b) `getAnonymousKey`(비게임, SDK ≥2.4.5, 로그인 화면 미노출) — Toss 신원 ↔ Supabase user 브리지 결정.
- **결제**: 실물→토스페이만(토스페이먼츠 PG 포함 기타 불가). **디지털 상품→인앱결제(IAP)만.** → **오늘케미 pay-per-use(케미카드 550 / 또 다른 나 440 / 케미 다시 맞추기 440 / 인연 슬롯 550원 IAP 판매가)는 디지털 콘텐츠 unlock → 미니앱 채널은 IAP 필수** (웹 채널은 토스페이먼츠 유지). = "토스 로그인/IAP 통합 작업"의 핵심.
- **광고**: 앱인토스 전면형/보상형/배너만. 외부 광고망 금지.

### 6.6 IAP 디지털 상품 제약
(§4.7 참조 — 소모품, 비게임 30개, 공급가 400~1,400,000원·10원 단위, 현금성/포인트결합 금지, 수수료 15%+5%, 환불 Apple/Google.) → 부적 token 모델 충돌, pay-per-use 직접 unlock 호환.

### 6.7 외부 링크 / 자사앱 홍보 금지
(doc `3a4727e22e4083fd`; §5.7 동일)
- 자사 앱 설치 유도 전면 금지 (앱 마켓 링크 포함).
- **"공유하기 기능의 링크가 자사 웹사이트로 랜딩되는 상태" = 위반** → 공유 링크 재포인팅 필수 (토스 공유 또는 미니앱 내 랜딩).
- "콘솔 '앱 내 기능'은 미니앱 내 완결적 경험" 필수 (전 기능 이식 불요).

### 6.8 다크패턴 금지 (검수 자동 반려)
(doc `b1cd33abe009994a`) 출시 불가:
1. 진입 즉시 화면 차단 바텀시트 (알림 동의 포함)
2. 백버튼 → 이전 화면 차단 바텀시트
3. 종료 옵션 없음 (파트너 CTA 만)
4. 흐름 중 예기치 않은 전면 광고
5. 다음 동작 예측 불가 CTA / 과장 서브카피
- 그래픽: 애원/부정감정 호소 금지, 장식 particle/과도 gradient 금지, 다크+라이트 가독성.
- UX writing: 해요체, 능동태, 긍정, 다이얼로그 좌측 버튼 **[닫기]** (절대 [취소] 아님).
- **함의**: 온보딩 AI 고지, paywall/FeaturePaySheet, 동의 프롬프트는 진입/백버튼 시 차단 바텀시트 금지, paywall 은 종료 옵션 제공, CTA 예측 가능 라벨.

### 6.9 TDS — 의무 범위 verdict
출처: MCP 서버 instruction (권위 플랫폼 가이드) + `b1cd33abe009994a` + `f4609af4abc1a3a3`
- **MCP instruction (명시)**: "**비게임 미니앱은 TDS 사용 필수**" + "TDS 는 검수 승인에 필수". → TDS 는 비게임 검수 **의무** 진술 (선택 아님).
- 웹 채널 패키지 (framework ≥1.0.0): `@toss/tds-mobile` (+ `@toss/tds-mobile-ait`, `@emotion/react@^11`, react/react-dom ^18); 루트 `TDSMobileAITProvider` 래핑.
- **의무 컴포넌트**: **Navigation bar** ("모든 화면 최상단에 ❖ Navigation 컴포넌트 반드시 사용") + (탭 사용 시) Toss 제공 floating 탭바(2~5개, 커스텀 하단탭 모방 금지).
- 브랜드: `granite.config.ts` `brand.icon`/`displayName`/`primaryColor`. 로고 600×600 정사각.
- Figma 가이드는 "권장" 표현이나 플랫폼 검수 룰(MCP + UX 가이드 의무 컴포넌트)이 지배.
- **CAVEAT/CONFLICT**: "TDS 검수 필수" 최강 진술은 **MCP instruction** (fetched doc verbatim 아님). fetched design 페이지는 Figma kit "권장" 이나 특정 TDS 컴포넌트(Navigation/floating tab/`TDSMobileAITProvider`) 의무화.
- **DECISION FLAG**: 기존 "Toss × iOS 26 × M3 Expressive" 디자인 시스템(`UIDesign/`)은 미니앱에 as-is 이식 불가 — 최소 nav bar 는 TDS/AIT 제공 컴포넌트, full TDS 채택이 검수 승인 안전 경로. **TDS 채택 깊이(full vs nav-bar-minimum + TDS-aligned 커스텀) = §1.1 결정.**

### 6.10 검수/출시 프로세스 + SLA + CORS
(doc `8971d4b432ecb114`, `6af044c79403a514`, `d990b2480c0b106f`)
- 앱정보 검토 1~2일 · 앱 내 기능 1~2일 · **번들 검토 최대 영업일 3일.**
- 검토 요청 버튼 = ≥1 테스트 완료 후. 한 번에 한 버전. 번들 ≤100MB.
- 반려 → 수정 → 재업로드 → 재요청. 출시 = 전 사용자 즉시. 롤백 가능.
- **프로덕션 CORS/Origin allowlist (라이브 전 등록)**: 라이브 `https://<appName>.apps.tossmini.com` + QR `https://<appName>.private-apps.tossmini.com`. → Supabase + Vite SPA 호출 API 가 둘 다 허용. **HTTP 는 샌드박스만, 라이브 HTTPS 전용(ATS)**. iOS 13.4+ 서드파티 쿠키 차단 → **토큰 기반 auth**.
- 사후 검수 → 위반 시 긴급 운영 중단. IAP 정산 = per-business.

### 6.11 비게임 검수 DONE 바 체크리스트 (열거)
- [ ] 사업자 등록 완료 (로그인+IAP 전제, §6.1a)
- [ ] 워크스페이스 + `appName` 확정 (수정 불가, §6.1b)
- [ ] 앱 내 기능 ≥1 등록, 이름 ≤10자, URL 라이브 (§6.2)
- [ ] 제한 카테고리 미해당 — 돈합 투자자문 프레이밍 회피 (§6.3)
- [ ] 6모드 단일 앱 탑재 (분리 금지, §6.3)
- [ ] AI 사전 고지(최초) + 결과 라벨/배지 (모든 AI 표면, §6.4)
- [ ] 로그인 = 토스 로그인만 (Supabase/Google 미니앱 내 미노출, §6.5)
- [ ] 디지털 상품 = IAP만 (토스페이먼츠 미니앱 미사용, §6.5)
- [ ] 외부 링크/자사앱 홍보 금지, 공유 = `intoss://` (§6.7)
- [ ] 다크패턴 0 (진입/백버튼 차단 바텀시트, 종료 옵션, [닫기], §6.8)
- [ ] TDS Navigation 컴포넌트 (+ 채택 깊이 결정, §6.9)
- [ ] iframe 0 (YouTube 제외)
- [ ] 핀치 줌 비활성 meta (§1.3c)
- [ ] CORS allowlist 2 도메인 등록 (§6.10)
- [ ] 번들 ≤100MB (§1.6)
- [ ] ≥1 토스앱 QR 테스트 완료 (검토 요청 게이트)
- [ ] IAP 3 샌드박스 시나리오 통과 (§4.8)

### 6.12 NOT FOUND in docs (정책)
- 운세/사주/궁합/fortune-telling 의 제한·"확인 필요" 카테고리 — **NOT FOUND** (리스크는 돈합 투자자문 또는 §8 재량).
- 데이팅/소개팅 특정 주의사항 — **NOT FOUND** (`/intro/caution.md` stub).
- `/checklist/app-nongame.md`·`/intro/caution.md` 렌더 본문 — **NOT FOUND** (TOC stub).
- TDS 가 fetched checklist 페이지에 verbatim "필수" 인지 (vs MCP instruction + 의무 컴포넌트) — TDS 채택 깊이 = 제품 결정.

---

## 7. 코드베이스 통합 맵

### 7.1 인증 — 31 라우트 Bearer/CORS 듀얼 auth 플랜
현재 **31개 API 라우트 핸들러 전부 쿠키 기반 Supabase auth** 단독 사용.

#### 공통 유저 해석 패턴
- 헬퍼: `createClient()` — `src/lib/supabase/server.ts:11` (SSR 클라이언트, `cookies()` 로 auth 쿠키 읽기, `supabase.auth.getUser()`).
- 미들웨어: `src/lib/supabase/middleware.ts:53` (`updateSession`) — `middleware.ts:6` 에서 매 요청. 토큰 refresh + 보호 경로 가드(미인증 → `/login` + `next`, line 108-113). public(login/signup/oauth/`/api/`) bypass.
- 401: `apiErrorResponse('UNAUTHORIZED', '', 401)` — `src/lib/errors/route-response.ts:4`.

#### 31 보호 라우트 (전부 `await createClient()` → `getUser()` early 401)
1. `src/app/api/auth/sign-out/route.ts:6` (POST)
2. `src/app/api/feed/route.ts:16` (GET, getUser:19)
3. `src/app/api/guest/today/route.ts` (미들웨어 암묵 auth)
4. `src/app/api/hapcards/[id]/change/route.ts` (hapcard read, pay-gate)
5. `src/app/api/hapcards/[id]/ohaeng-interpretation/route.ts:38` (GET, getUser:38) — read-path 게이트 line 65
6. `src/app/api/hapcards/[id]/replay/route.ts` (pay-per-use replay read)
7. `src/app/api/hapcards/[id]/role-analysis/route.ts:38` (GET, getUser:38) — read-path 게이트 line 65
8. `src/app/api/hapcards/[id]/share/route.ts` (share token)
9. `src/app/api/hapcards/[id]/snapshots/route.ts`
10. `src/app/api/hapcards/route.ts:72` (POST, getUser:73)
11. `src/app/api/legal/consent/route.ts`
12. `src/app/api/legal/documents/[slug]/route.ts`
13. `src/app/api/legal/social-consent/route.ts`
14. `src/app/api/me/chart/route.ts`
15. `src/app/api/me/delete-request/route.ts`
16. `src/app/api/me/export/route.ts`
17. `src/app/api/me/route.ts:18` (GET, PATCH, getUser:18)
18. `src/app/api/me/wallet/route.ts`
19. `src/app/api/memos/[memoId]/route.ts`
20. `src/app/api/onboarding/route.ts:21` (POST, getUser:21)
21. `src/app/api/payments/feature/confirm/route.ts:43` (GET, getUser:43)
22. `src/app/api/payments/feature/init/route.ts:52` (POST, getUser:52)
23. `src/app/api/relations/[id]/memos/route.ts`
24. `src/app/api/relations/[id]/route.ts`
25. `src/app/api/relations/[id]/timeline/route.ts`
26. `src/app/api/relations/route.ts:25` (GET, POST, getUser:25)
27. `src/app/api/rewards/session/route.ts`
28. `src/app/api/share/complete/route.ts`
29. `src/app/api/share/kakao/callback/route.ts`
30. `src/app/api/today/route.ts:161` (GET, getUser:162)
31. `src/app/api/whatif/[type]/route.ts:65` (POST, getUser:65)

#### Bearer + 쿠키 듀얼 auth + CORS 변경 (gaps)
1. **Bearer 토큰 지원 없음**: 어디에도 `Authorization: Bearer` 파싱 없음.
2. **CORS 헤더 없음**: 명시 `Access-Control-Allow-*` 없음 (미들웨어 기본 의존).
3. **크로스오리진 미니앱 호출**: Supabase 세션 쿠키 `HttpOnly` → 크로스오리진 XHR/fetch 미전송.

수정 지점:
- `src/lib/supabase/server.ts` → 대안 `createClientFromBearerToken(token: string)` (쿠키 대신 Supabase `Session` constructor).
- `src/lib/supabase/middleware.ts` → `Authorization` 헤더 있으면 refresh 스킵(pass-through).
- 각 보호 라우트 → `request.headers.get('authorization')` Bearer 추출 후 쿠키 `createClient()` fallback.
- 라우트 헤더 → `Access-Control-Allow-Origin`(`*` 또는 §6.10 두 토스 도메인 제한), `-Methods: GET, POST, PATCH, DELETE`, `-Headers: Authorization, Content-Type`.
> **계정 모델 결정 (§8)**: 미니앱 로그인=토스 로그인만(§6.5) → Toss `userKey`(앱 스코프 int) ↔ Supabase user 매핑 필요. iOS 쿠키 차단(§5.5) → 토큰 기반 영속.

### 7.2 pay-per-use 잠금 모델 — IAP unlock 재사용
**단일 출처**: `isFeatureUnlocked` — `src/lib/payments/feature-unlock.ts:14` (token_ledger OR payments, 순서):
```typescript
// 1. Free — token_ledger 차감 기록 (reason `${feature}_use`, reference_id ref) → true
// 2. Paid — payments (feature_id, feature_ref, status='confirmed') → true
```
**하이브리드 라우터**: `resolveFeatureCharge` — `src/lib/payments/feature-gate.ts:32` → `'free' | 'unlocked' | 'pay_required'`:
- 이미 unlock → `unlocked` (charge X)
- `deduct_tokens_once` RPC 시도 → 성공 `free`
- `INSUFFICIENT_TOKENS`(P0001) → `pay_required`

**read-path 게이트** (콘텐츠 노출 전): `ohaeng-interpretation/route.ts:65` + `role-analysis/route.ts:65`:
```typescript
if (!(await isFeatureUnlocked(service, userId, 'hapcard', hapcard.cache_key)))
  return paymentRequiredResponse('hapcard', hapcard.cache_key, FEATURE_PRICES_KRW.hapcard.amount_krw);
```
**확정 흐름**: init(`feature/init/route.ts:122`, pending insert) → confirm(`feature-complete.ts:135`, `confirm_feature_payment` RPC, `status='confirmed'`).

#### IAP `processProductGrant` 서버 unlock (기존 게이트 재사용 — 코드 중복 0)
Toss 안 거치고 IAP 로 unlock:
```typescript
await serviceClient.from('payments').insert({
  user_id: userId,
  toss_order_id: `iap_${platform}_${transactionId}`,  // 비-Toss order id
  toss_customer_key: null, toss_payment_key: null,
  charge_type: 'feature_use',
  feature_id: featureId,        // 'hapcard' | 'whatif' | 'replay' | 'relation_slot'
  feature_ref: ref,             // cache_key 또는 pending_id ref
  amount_krw: FEATURE_PRICES_KRW[featureId].amount_krw,
  status: 'confirmed',          // KEY: 직접 confirmed
  confirmed_at: new Date().toISOString(),
});
```
→ **read-path 게이트 무변경**: `isFeatureUnlocked()` 가 `status='confirmed'` IAP row 발견 → `true`. 신규 컬럼 0.
- **환불 (REFUNDED)**: payments row `status='refunded'` 마킹 (poll 기반, §4.6) — 토큰 RPC `refund_tokens_once()` 와 별개 IAP 경로.

#### Feature Prices (2026-06-14, `src/lib/payments/feature-prices.ts`)
**오픈 할인 50%** (`OPENING_DISCOUNT_PERCENT = 50`, line 11; 현금 결제만, "오픈초기 50% 할인"):
| feature | list_krw | amount_krw(50%↓) | token | order_name | llm_generated |
|---|---|---|---|---|---|
| hapcard | 1,100 | 550 | 11 | 케미카드 보기 | true |
| whatif | 880 | 440 | 9 | 또 다른 나 보기 | true |
| replay | 880 | 440 | 9 | 케미 다시 맞추기 | true |
| relation_slot | 1,100 | 550 | 11 | 인연 등록 | false |
- `FREE_RELATION_SLOTS = 2` (line 74; ADR-039 Amended Model B — 3번째+ 유료). 게이트 `relations/route.ts:64` `insertFreeRelationIfUnderCap()`.
- `LLM_GENERATED_FEATURES = ['hapcard','whatif','replay']` (line 59), `LLM_FREE_USE_REASONS` (line 63) — `checkCashGenLimit()` 게이트.
- 단일 검증: `getFeaturePrice(id: string)` (line 77) → 클라 supplied feature string 재검증 (`feature/init/route.ts:48`).
> **IAP 카탈로그 동기 결정 (§8)**: 콘솔 SKU 공급가(VAT 제외) ↔ amount_krw. 오픈 50% 할인을 IAP 카탈로그에 반영할지 (플랫폼별 할인 override).

### 7.3 8-flow Next→Vite 마이그레이션 비용 표
현 스택: Next.js 16.2.6 + React 19 App Router, next-intl(ko), Tailwind 4, shadcn/ui, TanStack Query + Zustand, Supabase. 미니앱은 Vite SPA + React Router v6.

| Flow | 라우트 복잡도 | Server Comp | OG/Meta | 비용 | 핵심 커플링 |
|---|---|---|---|---|---|
| 온보딩 | High (4 step) | 1 | 없음 | **3~4일** | `useRouter`×5·`usePathname`·`redirect`; draft-store(Zustand) 보존 |
| 인연등록 | High (3 step) | 1 | 없음 | **3일** | `useRouter`×5·`Link`×2·`useQueryClient`; FeaturePaySheet 클라 |
| 케미피드 | Medium | 0 | 없음 | **2~3일** | `useRouter`×6·`useSearchParams`×2·`Link`×2; Recharts/SwipeRow 순수 |
| 케미카드 | Medium | 1 | 없음(stub) | **2~3일** | `useParams`·`useRouter`×4·`useSearchParams`; generateMetadata 제거; easyMode localStorage |
| 오늘케미 | Medium | 1 | 없음 | **2일** | server `redirect()`+`createClient()`→클라 가드; `useRouter`×3 |
| 본명식(me) | Low | 0 | 없음 | **1~2일** | `useRouter`×3; next-themes 보존 |
| 또다른나 | Low | 0 | 없음 | **1일** | `useParams` (server 커플링 0) |
| 다시맞추기 | None | 0 | 없음 | **<1일** | 라우팅 0, useMutation 보존 |
| (공유) | Low | 1 | **Yes** | **1~2일** | generateMetadata·next/image; OG 라우트 serverless |
- **총 추정: 15~21일 (2~3주). 리스크 Medium (라우팅·결제 플로우 re-plumbing).**

#### 제거 의존성
- `next/navigation` (34 파일): `useRouter`→`useNavigate`, `useSearchParams`→RR `useSearchParams`/`use-query-params`, `usePathname`→`useLocation().pathname`, `useParams`→RR `useParams`(1:1), `redirect()`→클라 `navigate()`+가드.
- `next/link` (~15): `<Link href>`→RR `<Link to>`/`<a>`.
- `next/image` (4: login/signup/share OG): `<Image>`→`<img>`.
- `next-intl` server API: `getMessages()`/`getLocale()`→클라 only, `<NextIntlClientProvider>` 루트 Vite 컴포넌트. `useTranslations()` 보존. `messages/ko.json` 보존.
- Server Components + generateMetadata (5): onboarding/page·(app)/page·hapcard/[id]/page·h/[token]/page → 클라 가드/SPA 전략.
- 미들웨어(`middleware.ts`, `src/lib/supabase/middleware.ts`): auth → 클라 컨텍스트 + Storage SDK (§5.5); 세션 refresh → TanStack Query/Supabase client.
- **보존**: next-themes, Zustand draft-store(onboarding/relations), TanStack Query, 디자인 토큰(`src/app/globals.css`), shadcn/ui(`src/components/ui/`).

#### ~40 API 엔드포인트 (전부 REST/JSON, GraphQL 없음)
온보딩 3 · 인연 CRUD 8 · 케미카드 8 · today/feed 3 · whatif 1 · 공유 5 · auth 2 · 결제 2 · 계정 3 · 기타 4.

#### 공유(Share) 별도
- `src/app/h/[token]/page.tsx` (Server, generateMetadata + next/image) · `src/components/hapcard/share.tsx` (클라).
- 엔드포인트: `POST /api/hapcards/[id]/share`(토큰), `GET /api/share/[token]`, `POST /api/share/kakao/callback`, `GET /api/og/hapcard/[id]`(동적 OG).
- 미니앱: §5.2 `getTossShareLink('intoss://<appName>/hapcard/<id>?layout=...')` + 공개 OG(`https://`, 1200×600 §5.6) → **현 401-to-crawler OG 와 충돌 해소 필요**.

---

## 8. 결정 의존 지점 (§5 런치 결정이 구현을 바꾸는 곳)

| 결정 | 영향 섹션 | 무엇이 바뀌나 |
|---|---|---|
| **D-SDK**: SDK 2.x vs 3.x(beta) | §1.1, §1.3, §1.4, §1.7 | config 파일명(`granite`→`apps-in-toss`), `brand` shape, `webViewProps`→`webView`, `outdir`→`webBundleDir`, `web.commands`→package.json, 빌드 `vite build && ait build`. 모든 셸/빌드 산출물. |
| **D-ACCOUNT** (계정 모델): 토스 로그인 vs `getAnonymousKey` | §2 전체, §3.7, §5.5, §7.1 | 토스 로그인 → §2 OAuth 흐름(10분/1h/14d 토큰)+disconnect 콜백+사업자 등록 필수+mTLS 토큰교환 엔드포인트. `getAnonymousKey` → 로그인 화면 미노출, OAuth 흐름 불요(IAP/프로모션 mTLS 는 여전히 필요). `toss-mtls-client.ts` 가 OAuth 흐름 포함 여부 결정. |
| **D-SCOPE**: `USER_BIRTHDAY`/`USER_GENDER` scope | §2.1, §2.5, §2.7 | scope ⊃ 이름/이메일/성별 → **disconnect 콜백(§2.7) 필수 = 런치 블로커**. 생일 `yyyyMMdd` 만 → 출생 시각 별도 입력 폼. |
| **D-CALLBACK**: 탈퇴 시 데이터 라이프사이클 | §2.7 | `WITHDRAWAL_TOSS`/`UNLINK` 시 relations/hapcards/user_charts hard-delete vs soft-disable vs anonymize. 핸들러 분기. (법무/제품) |
| **D-INFRA**: Vercel mTLS + 정적 egress IP | §3.3, §3.4 | Vercel serverless 는 mTLS client cert + 정적 Outbound IP 둘 다 native 미제공 → 고정 egress mTLS proxy/gateway 또는 로그인 백엔드 Vercel 외부. `toss-mtls-client.ts` 호스팅 위치. |
| **D-PAY** (결제 채널): IAP vs 토스페이먼츠 | §4 전체, §6.5, §7.2 | 미니앱 디지털 상품=IAP 필수(토스페이먼츠 미니앱 미사용). IAP `processProductGrant`→payments `status='confirmed'` insert(§7.2 재사용). 30초 지급 창 + 복구 흐름 + 환불 poll. 오픈 50% 할인 IAP 카탈로그 반영. |
| **D-AUTH-TRANSPORT**: 쿠키 vs 토큰 | §5.5, §7.1 | iOS 13.4+ 서드파티 쿠키 차단 → 토큰 기반 + Storage SDK. 31 라우트 Bearer 듀얼 auth + CORS 헤더. |
| **D-SHARE**: 공유 타깃 + OG | §5.2, §5.6, §5.7, §7.3 | 공유=`intoss://` 딥링크만(자사 사이트 랜딩 위반). OG=공개 auth-free https 1200×600(현 401-crawler·1200×630 충돌). 케미카드 5종 = layout별 딥링크+OG. |
| **D-TDS**: TDS 채택 깊이 | §1.1, §6.9 | full TDS vs nav-bar-minimum. Navigation 컴포넌트 의무. `UIDesign/` (Toss×iOS26×M3) 미니앱 as-is 이식 불가. 검수 승인 안전 경로=full. |
| **D-MONEYHAP**: 돈합 프레이밍 | §6.3 | 투자자문/종목추천/금융상품 추천 = 출시 불가 카테고리. 돈합 카피/LLM = 관계·성향 케미 엔터 프레이밍 유지. |
| **D-FUNCTION**: 앱 내 기능 선택 | §6.2 | ≥1 등록, ≤10자 한국어, 라이브 URL (예: `intoss://todaychemi/feed`). 어느 오늘케미 엔트리 노출. |
| **D-ROLLOUT**: 점진 출시 부재 | §1.8 | 플랫폼 카나리 레버 없음 → 출시·롤백 all-users-immediate. QA 계획(번들 검수 게이트 전 충분 테스트). |

---

## 9. 미확인 / NOT-FOUND 목록 (채널톡 확인 대상)

### 셸/빌드 (§1)
1. WebView 2.x config 전용 필드별 `defineConfig` 레퍼런스 (`.../UI/Config.html` 미회수).
2. WebView 전용 `AppsInToss.registerApp` 셸 시그니처 (RN 만 문서화).
3. `@apps-in-toss/web-framework` 2.x 정확한 버전 번호 (CI/CD `ait deploy` ≥v1.4.0 제약만).
4. 퍼센트/단계/카나리 롤아웃 메커니즘 (없음; all-users-immediate).
5. `ait deploy` 가 검수 제출/출시 가능 여부 (업로드+테스트 스킴 반환만 명시).

### 로그인/mTLS (§2, §3)
6. Node.js/TS AES-256-GCM 복호화 샘플 (Kotlin/PHP/Java 만) → 포팅 필요.
7. §2.7 콜백 기대 HTTP status/body, 재시도 정책, 중복/멱등 보장.
8. production `appLogin()` `referrer` 가 `DEFAULT`/`SANDBOX` 외 값 가능 여부.
9. mTLS 인증서 유효기간/만료 duration ("만료 전 재발급" 만).
10. 다중 인증서 overlap/rotation 정확 시맨틱 (동시 유효 창·revocation).
11. mandated TLS 버전/cipher suite/key 알고리즘·크기 (예제 = X.509 + PKCS#8 RSA 빈 passphrase 추정).
12. env PEM 읽기 (Vercel 패턴) — 문서는 파일 읽기 (Node 기능 동치).
13. Throttle 응답 HTTP code / 차단 duration / `Retry-After`.
14. `resultType: FAIL` 동반 HTTP status.
15. 3초 readTimeout 이 unlink-by-userKey 외 적용 여부.
16. refresh-token reuse/rotation 시맨틱 (14일 외).
17. 실제 AAD 값 (발급 이메일 확인 — 샘플 `"TOSS"` 리터럴 아님).

### IAP (§4)
18. `createOneTimePurchaseOrder` 에러코드 enum + `onError` payload type (빈 섹션).
19. IAP 일회성 환불 webhook 계약 (poll only 추정; 콘솔 결제 알림 URL = 구독용).
20. apps-in-toss→partner inbound 방화벽 IP/포트 (DOC-B 표 empty; DOC-A 가 보유 §3.4).
21. IAP 함수 시그니처가 SDK 1.x↔2.x 변경 여부.
22. WebView/Vite 채널 IAP 노출 최소 `@apps-in-toss/web-framework` 버전.

### 공유/라이프사이클 (§5)
23. `share()` 에러코드/enum + timeout 동작.
24. 웹 채널 export 확인: `getSchemeUri`/`useVisibility`/`useVisibilityChange`/`setIosSwipeGestureEnabled`/`closeView` (RN 만 문서화) → 설치 타이핑 확인.
25. `appsInTossEvent` API surface + "앱 진입 완료 이벤트" 시그니처.
26. Storage 값 크기 제한 + 에러코드.
27. OG 엔드포인트가 익명 크롤러에 200 반환 의무 명시 (메커니즘상 함의).

### 정책 (§6)
28. 운세/사주/궁합/fortune-telling 의 제한·확인필요 카테고리 (없음 — 리스크는 돈합 투자자문/§8 재량).
29. 데이팅/소개팅 특정 정책 (caution.md stub).
30. `/checklist/app-nongame.md`·`/intro/caution.md` 렌더 본문 (TOC stub).
31. TDS 가 fetched checklist 페이지에 verbatim "필수" 인지 (MCP instruction + 의무 컴포넌트 vs Figma "권장").

---

*문서 끝. 본 레퍼런스의 모든 SDK 시그니처·문서 인용은 verbatim 보존. 구현 진입 전 §1.1 비협상 결정 사용자 승인 확인.*

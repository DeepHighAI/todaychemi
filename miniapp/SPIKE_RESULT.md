# miniapp P0 호환성 스파이크 결과 (2026-06-14)

**결론: GO — React 19 경로로 `.ait` 빌드 검증 완료.**

## 검증된 사실
- 스택: **Vite 8.0.16 + @vitejs/plugin-react 6 + React 19.2.4 + @apps-in-toss/web-framework 2.7.0**.
- 앱 핵심 무거운 의존성(recharts 3.8.1 · vaul 1.1.2 · @base-ui/react 1.5.0 · @tanstack/react-query · zustand · lucide-react) 전부 React 19에서 **설치·번들 충돌 없음**.
- `ait build` 성공 → `vite ✓ 574 modules transformed` → RN 0.84.0 + 0.72.6 두 런타임 번들 → **`todaychemi.ait` 3.84MB** 생성(100MB 한도 무난). `deploymentId` 발급됨.
- `@apps-in-toss/web-framework@2.7.0` peerDependencies = `{}` → **React 버전 무관(React 19 지원).**

## 결정 강제 사실 (§5-2)
- **TDS WebView `@toss/tds-mobile@2.4.1` peer = `react ^16.8.3 || ^17 || ^18`** → **React 19 제외.** TDS 채택 시에만 React 18 다운그레이드 필요.
- ∴ **React 19 + no-TDS(자체 디자인) = 오늘 빌드됨(최소 비용).** TDS 검수 의무 확인 시에만 React 18 경로.

## 함정 / 메모
- `@vitejs/plugin-react@6.0.2` 는 `vite ^8` 필요 — Vite 7.x 는 `vite/internal` 미export로 `ait build` 실패. **Vite 8 핀 필수.**
- `ait init` 은 "dev 번들러 명령" 입력에서 대화형 프롬프트 → 비대화 환경에선 `granite.config.ts` **수기 작성**이 안전(스크립트 산출물에 그렇게 함).
- `ait build` = 내부적으로 `npx vite build`(granite.config `web.commands.build`) 후 RN 런타임용 번들로 포장 → `dist/`에 `bundle.android/ios.*` 생성. RN peer 경고는 WebView 경로와 무관(무시).
- 비대화 init flags: `ait init --template web-framework --app-name <kebab>`.
- 스파이크 산출물(`node_modules/`, `dist/`, `*.ait`)은 빌드 아티팩트 → gitignore 대상.

## 미완(사용자 기기 필요)
- 샌드박스 앱 부팅 시각 검증(`intoss://todaychemi`)은 실기기/시뮬레이터 필요 → P7 device QA로 이관.

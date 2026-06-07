# 오늘케미 — Frontend Implementation Handbook

> Single-source reference for porting the `UIDesign/` prototype to the
> production stack. Read top to bottom on day 1; bookmark sections for
> reference during implementation.

**Prototype source:** `C:\DEV\SAJU\UIDesign\` (12 files, ~3,800 lines)
**Target stack:** locked by ADR-037 (see `tech_stack.md`)
**Product spec:** `PRD.md`
**Scope:** Phase 1 MVP through Phase 4 — all screens, all phases

---

## 0. Snapshot

오늘케미 is a Korean relationship-astrology CRM PWA. The prototype (`UIDesign/`)
validated visual language and interaction flows using React 18 + Babel CDN with
no bundler. Production uses Next.js 15 (App Router) + TypeScript strict +
Tailwind CSS + shadcn/ui + Radix + TanStack Query + Zustand + Recharts +
next-intl + Supabase + Vercel. This document maps every prototype artifact —
tokens, primitives, routes, i18n keys, state stores, animation contracts — to
its production equivalent.

Nothing in this doc is a new architectural decision. Every decision is already
locked in `tech_stack.md` (ADR-037), `PRD.md`, or the ADRs cited inline.

---

## 1. Stack (confirmed, do not change)

| Layer | Production | Notes |
|---|---|---|
| Framework | Next.js 15 App Router | Not Pages Router |
| Language | TypeScript strict | `noEmit` check before every PR |
| Styling | Tailwind CSS | No Emotion, no styled-components |
| UI primitives | shadcn/ui (CLI add-per-component) + Radix | Not full pre-install |
| Client state | Zustand | UI state only; no server data here |
| Server state | TanStack Query v5 | Supabase reads + invalidation |
| i18n | next-intl | KO primary; EN/VI/TH/MS/ID via locale segments |
| DB / Auth | Supabase (Postgres + RLS + Auth + Storage) | Free tier Phase 1-2 |
| LLM | OpenAI GPT-5 (핵심), GPT-5 (딥합), GPT-5 mini (오늘 케미) | Fallback: Claude Sonnet 4.6 / Haiku 4.5 |
| Hosting | Vercel Hobby | Phase 3 SEA: re-evaluate Cloudflare |
| Charts | Recharts | Secondary; custom SVG preferred for `Ohaeng`, `Radar` |
| PWA | next-pwa or custom Service Worker | TWA via Bubblewrap (ADR-031) |
| Payments | 토스페이먼츠 (Phase 1); Stripe (Phase 3 SEA) | ADR-005 |
| Tests | Vitest + Playwright + Zod | Unit + E2E + schema |

---

## 2. Project structure

Scaffold this layout at `pnpm create next-app`:

```
saju-app/
├─ app/
│  ├─ (marketing)/
│  │  ├─ page.tsx                   # S-00 splash / landing
│  │  └─ onboard/page.tsx           # S-01 onboarding carousel
│  ├─ (auth)/
│  │  └─ callback/route.ts          # Google OAuth redirect
│  ├─ (app)/
│  │  ├─ layout.tsx                 # bottom TabBar, i18n, theme providers
│  │  ├─ today/page.tsx             # S-03 오늘 홈
│  │  ├─ feed/
│  │  │  ├─ page.tsx                # S-04 인연 그리드
│  │  │  └─ [relationId]/
│  │  │     ├─ page.tsx             # S-09 인연 디테일 + 타임라인
│  │  │     └─ result/page.tsx      # S-07 케미카드
│  │  ├─ relation/
│  │  │  └─ new/
│  │  │     ├─ page.tsx             # S-01-A 진입 / S-05 등록 폼 (multi-step)
│  │  │     └─ mode/page.tsx        # S-06 6모드 선택
│  │  ├─ profile/page.tsx           # S-02 본인 본명식
│  │  ├─ paywall/page.tsx           # S-98 결제 / 충전 / 구독
│  │  └─ explore/page.tsx           # S-08 이런건어때 시트
│  ├─ api/
│  │  ├─ hapcard/route.ts           # streaming Server Action → OpenAI
│  │  └─ today/route.ts             # 오늘 케미 Route Handler
│  ├─ layout.tsx                    # root layout: fonts, meta, providers
│  └─ globals.css                   # token vars, dark-mode overrides
├─ components/
│  ├─ ui/                           # shadcn add output
│  ├─ primitives/                   # custom: AppBar, TabBar, LiquidHero, etc.
│  ├─ hapcard/                      # 8-component hapcard composition
│  └─ feedback/                     # ErrorCard, Skeleton, EmptyState
├─ lib/
│  ├─ supabase/
│  │  ├─ client.ts                  # browser Supabase client
│  │  └─ server.ts                  # server-side Supabase client (cookies)
│  ├─ saju/
│  │  └─ index.ts                   # fortune-core bridge (monorepo package)
│  └─ utils.ts
├─ stores/
│  ├─ theme.ts                      # Zustand: light / dark
│  ├─ lang.ts                       # Zustand: locale (ko / en / vi / th / ...)
│  └─ ui.ts                         # Zustand: onboard step, sheet open/close
├─ hooks/
├─ messages/
│  ├─ ko.json                       # next-intl (lifted from I18N_DICT.ko)
│  ├─ en.json                       # (lifted from I18N_DICT.en)
│  ├─ vi.json                       # Phase 3 — translate + Noto Sans
│  └─ th.json                       # Phase 3
├─ types/
│  ├─ relation.ts                   # RelationRow, RelationCreate
│  ├─ hapcard.ts                    # HapcardResult, HapcardMode
│  ├─ user.ts                       # UserProfile, BirthData
│  └─ index.ts                      # barrel
└─ tailwind.config.ts
```

**Contracts-first rule (CLAUDE.md):** create `types/*.ts` interfaces before
implementing any feature. Run `tsc --noEmit` to verify.

---

## 3. Design token migration — `UIDesign/system.css` → Tailwind

### 3.1 Token mapping

Everything in `system.css` becomes a CSS variable in `globals.css` (light +
dark values) and is referenced from `tailwind.config.ts` via `var(--token)`.
Do not hard-code hex values in component code.

#### M3 purple tonal palette

| CSS var (light) | CSS var (dark) | Tailwind key | Hex light |
|---|---|---|---|
| `--p-10` | inverted | `colors.primary[10]` | #21005D |
| `--p-20` | `#D0BCFF` | `colors.primary[20]` | #381E72 |
| `--p-30` | `#B69DF8` | `colors.primary[30]` | #4F378B |
| `--p-40` | `#CFBCFF` | `colors.primary[40]` | #6750A4 — **brand primary** |
| `--p-60` | same | `colors.primary[60]` | #9A82DB |
| `--p-80` | `#4F378B` | `colors.primary[80]` | #D0BCFF |
| `--p-90` | `#381E72` | `colors.primary[90]` | #EADDFF |
| `--p-95` | `#2B1761` | `colors.primary[95]` | #F6EDFF |
| `--p-98` | `#21005D` | `colors.primary[98]` | #FEF7FF |

#### Secondary / Tertiary

| CSS var | Tailwind key | Notes |
|---|---|---|
| `--s-30`, `--s-40`, `--s-90`, `--s-95` | `colors.secondary[30/40/90/95]` | Soft purple |
| `--t-30`, `--t-40`, `--t-90` | `colors.tertiary[30/40/90]` | Warm accent |

#### Surfaces

| CSS var | Light | Dark | Tailwind key |
|---|---|---|---|
| `--bg` / `--surface` | #FFFBFE | #141218 | `colors.surface.DEFAULT` |
| `--surface-1` | #F7F2FA | #1D1B20 | `colors.surface[1]` |
| `--surface-2` | #F0E9F5 | #211F26 | `colors.surface[2]` |
| `--surface-3` | #EADDFF | #2B2930 | `colors.surface[3]` |
| `--on-surface` | #1D1B20 | #E6E0E9 | `colors.onSurface` |
| `--on-surface-var` | #49454F | #CAC4D0 | `colors.onSurfaceVar` |
| `--outline` | #79747E | #938F99 | `colors.outline` |
| `--outline-variant` | #CAC4D0 | #49454F | `colors.outlineVariant` |

> PRD §7.2 overrides these defaults for the happlе brand palette. The PRD
> values take precedence over the M3 surface defaults where they differ:

| PRD token | Light | Dark | Use |
|---|---|---|---|
| `--bg-canvas` | #FBF8F3 | #14151C | Page background |
| `--bg-card` | #FFFFFF | #1C1D26 | Card background |
| `--text-primary` | #1A1B23 | #ECE6D6 | Body copy |
| `--text-secondary` | #5A5B66 | #A8A8B5 | Secondary copy |
| `--hairline` | #E8E4DB | #2A2B36 | Dividers |

Add both sets to `globals.css`. PRD tokens map to their own Tailwind keys
(`colors.bgCanvas`, `colors.bgCard`, `colors.textPrimary`, etc.).

#### 오행 element colors (PRD §7.2)

| Element | Light | Dark | Tailwind key |
|---|---|---|---|
| 木 (Wood) | #6FB59A | #5A9580 | `colors.element.wood` |
| 火 (Fire) | #E07A5F | #BD6650 | `colors.element.fire` |
| 土 (Earth) | #C9A47A | #A88862 | `colors.element.earth` |
| 金 (Metal) | #C0C5CE | #9DA3AC | `colors.element.metal` |
| 水 (Water) | #5B7DB1 | #4A6896 | `colors.element.water` |

60갑자 일주 chip colors are derived programmatically: 5 element base colors
× 天干 음양 ±10% lightness. Build a `lib/saju/chip-color.ts` utility;
do not hard-code 60 hex values.

Prototype `Ohaeng` primitive uses `#7CB342 / #FF5E00 / #A47148 / #B0BEC5 /
#0066FF`. Replace these with PRD §7.2 tokens in production.

#### Semantic colors

| CSS var | Light | Dark | Tailwind key |
|---|---|---|---|
| `--ok` | #386A20 | #91D29E | `colors.semantic.ok` |
| `--ok-bg` | #D7E8DA | #1F3A24 | `colors.semantic.okBg` |
| `--warn` | #B3261E | #F2B8B5 | `colors.semantic.warn` |
| `--warn-bg` | #FFDAD6 | #4A1E1B | `colors.semantic.warnBg` |
| `--info` | #0066FF | #A8C7FF | `colors.semantic.info` |
| `--info-bg` | #EAF2FE | #1B2841 | `colors.semantic.infoBg` |

#### Liquid Glass gradient stops

| CSS var | Light | Dark | Usage |
|---|---|---|---|
| `--lg-1` | #4F46E5 | #6B5BE5 | Hero gradient start |
| `--lg-2` | #6541F2 | #7B5BF2 | |
| `--lg-3` | #9333EA | #A93BEA | |
| `--lg-4` | #FF5E00 | #FF6B1A | Hero gradient end / accent |

Tailwind: `backgroundImage: { 'liquid-hero': 'linear-gradient(135deg, var(--lg-1), var(--lg-2), var(--lg-3), var(--lg-4))' }`.

#### Typography

Load Pretendard JP via `next/font` — not the prototype's CDN `@import`:

```ts
// app/layout.tsx
import localFont from 'next/font/local';
const pretendard = localFont({
  src: '../public/fonts/PretendardJP-Variable.woff2',
  variable: '--font-display',
});
```

| CSS var | Tailwind key | Value |
|---|---|---|
| `--font-display` / `--font-body` | `fontFamily.display`, `fontFamily.body` | Pretendard JP → Pretendard → system-ui |
| `--t-display-l` | `fontSize.displayL` | 800 32px / 1.2 |
| `--t-display` | `fontSize.display` | 800 28px / 1.24 |
| `--t-h1` | `fontSize.h1` | 800 24px / 1.32 |
| `--t-h2` | `fontSize.h2` | 700 18px / 1.36 |
| `--t-h3` | `fontSize.h3` | 600 15px / 1.4 |
| `--t-body` | `fontSize.body` | 400 14px / 1.5 |
| `--t-sub` | `fontSize.sub` | 400 13px / 1.45 |
| `--t-cap` | `fontSize.cap` | 500 12px / 1.4 |
| `--t-mono` | `fontSize.mono` | 500 11px / 1 |
| `--ls-tight` | `letterSpacing.tight` | -0.022em |
| `--ls-snug` | `letterSpacing.snug` | -0.016em |

PRD §7.3: body 17pt / line-height 1.7, headline SemiBold 22pt. These
override the prototype's type scale at the component level (the prototype
was designed at a smaller phone canvas size).

#### Radius, Spacing, Elevation

| CSS var | Tailwind key |
|---|---|
| `--r-xs` 8px | `borderRadius.xs` |
| `--r-sm` 12px | `borderRadius.sm` |
| `--r-md` 16px | `borderRadius.md` |
| `--r-lg` 20px | `borderRadius.lg` |
| `--r-xl` 24px | `borderRadius.xl` |
| `--r-pill` 999px | `borderRadius.pill` |
| `--s-1..--s-10` (4-40px) | Tailwind default spacing (4 → `1`, 8 → `2`, 12 → `3`, 16 → `4`, 20 → `5`, 24 → `6`, 32 → `8`, 40 → `10`) |
| `--e-1` | `boxShadow.e1` |
| `--e-2` | `boxShadow.e2` |
| `--e-3` | `boxShadow.e3` |

### 3.2 Dark mode strategy

Prototype uses `[data-theme="dark"]` on `<body>`. Production: use
`next-themes` with `attribute="class"` so Tailwind's `dark:` prefix works.
CSS variables in `globals.css` switch on `:root.dark` (or `.dark body`).
This keeps component code clean — no manual `data-theme` checks in JSX.

On first paint, `next-themes` injects an inline script to avoid flash
(FOUC). Confirm it precedes the body render.

---

## 4. Primitive migration — `UIDesign/primitives.jsx` → production

| Prototype primitive | Production target | File | Notes |
|---|---|---|---|
| `StatusBar` | **Drop** | — | Simulates iOS chrome. PWA uses real status bar. |
| `Phone` | **Drop** | — | Canvas-mode wrapper only. |
| `AppBar` / `IAppBar` | Custom `<AppBar>` | `components/primitives/AppBar.tsx` | Left / title / right slots via Radix Slot. `large` variant from prototype maps to large title variant. Min-height 44px, `safe-area-inset-top`. |
| `Progress` | `shadcn Progress` | `components/ui/progress.tsx` | `shadcn add progress` |
| `Btn` | `shadcn Button` | `components/ui/button.tsx` | variant=default (primary), secondary (tonal), ghost (text), outline. `dark` variant → drop; use `variant="default"` with Tailwind dark. |
| `CTA` | Full-width `Button` preset | `components/primitives/CTA.tsx` | `className="w-full"` wrapper with bottom safe area padding. |
| `Chip` (일주 chip) | Extended `shadcn Badge` | `components/primitives/Chip.tsx` | Add `element` prop (`'wood' | 'fire' | 'earth' | 'metal' | 'water'`) driving 60갑자 color token. `on` prop → selected state. |
| `Seg` | `Radix ToggleGroup` | `components/primitives/SegControl.tsx` | Single-select. Tailwind styling only. |
| `Icon` (14 SVGs) | `lucide-react` | — | `import { Home, Sparkles, User, Plus, MoreHorizontal, X, ChevronLeft, ChevronRight, Check, Lock, Trash2, Pencil, ArrowUpRight, Zap } from 'lucide-react'` — drop inline SVGs. |
| `TabBar` | Custom `<TabBar>` | `components/primitives/TabBar.tsx` | Bottom-fixed, `pb-safe` (safe-area-inset-bottom), 3 tabs: 오늘 / 케미피드 / 내 프로필. Active state via `usePathname()`. |
| `Row` | Utility composition | — | No dedicated component. Use `<div className="flex items-center gap-3">` inline. |
| `LiquidHero` | Custom `<LiquidHero>` | `components/primitives/LiquidHero.tsx` | CSS gradient from `--lg-1..--lg-4` + `backdrop-filter: blur`. Eyebrow / score / meta / bar slots. |
| `Ohaeng` | Custom `<OhaengMap>` | `components/primitives/OhaengMap.tsx` | Custom SVG — 5 vertical bars. Uses `colors.element.*` tokens. PRD §6 shows **pentagon** (레이더) style for 오행맵 [3]; the bar chart is a secondary viz. Confirm with designer which to use as the primary hapcard [3]. |
| `Radar` | Custom `<Radar>` | `components/primitives/Radar.tsx` | Port SVG paths nearly as-is from `primitives.jsx:198-234`. Replace `#6750A4` with `var(--p-40)`. Replace `#CAC4D0` with `var(--outline-variant)`. Replace `#1D1B20` with `var(--on-surface)`. |
| `Timeline` | Custom `<Timeline>` | `components/primitives/Timeline.tsx` | Port D-N to D+N bar chart from `primitives.jsx:237-254`. Intersection Observer for active-marker scroll snap. |
| `MockInput` | `<input>` / `<button>` | — | Replace with real HTML input. Prototype mock was touch-only stub. |
| `Tray` | Radix `Dialog` (mobile bottom sheet) or vaul `Drawer` | `components/ui/drawer.tsx` | `shadcn add drawer` — uses vaul under the hood. Birth-date and birth-time pickers live inside Drawer sheets. |
| `WheelPicker` | Native `<select>` on mobile or custom scroll-wheel | `components/primitives/WheelPicker.tsx` | Build a CSS snap-scroll wheel for birth hour (12지); no dependency preferred. |
| `MiniCalendar` | `react-day-picker` or custom | `components/primitives/MiniCalendar.tsx` | Birth date picker; lunar ↔ solar toggle. Must support 양력/음력 conversion via fortune-core. |
| `SheetLayer` | Radix `Dialog` + vaul `Drawer` | — | `hapcard_expand` → `Drawer` (sheet from bottom). `paywall` → `Dialog` or `Drawer`. |

---

## 5. Screen inventory mapping

All screens from PRD §5. Columns: screen ID / name / prototype component /
App Router path / primary dependencies (Supabase tables, fortune-core calls,
OpenAI model) / phase.

### 5.1 Phase 1 MVP (launch-critical)

PRD designer work order: S-01-A → S-05 → S-06 → S-07 → S-04 → S-03 →
S-99 → S-96 → S-08.

| # | ID | Name | Prototype | Route | Data deps | Phase |
|---|---|---|---|---|---|---|
| 1 | S-01 | Onboarding / Google OAuth | `ISplash`, `IOnboard` | `/(marketing)/onboard` | Supabase Auth (Google) | 1 |
| 2 | S-01-A | 인연 등록 입구 | `ScreenHome` (partial) | `/(app)/relation/new` | — | 1 |
| 3 | S-02 | 본인 본명식 입력 | `IBirthDob`, `IBirthTime`, `IBirthCal`, `IBirthReview` in `screens-interactive.jsx` | Inline step in `/(app)/relation/new` (not standalone screen) | fortune-core 일주 calc | 1 |
| 4 | S-03 | 오늘 홈 | `ScreenHome` (`screens-relation.jsx`) | `/(app)/today` | `daily_hap` table, GPT-5 mini | 1 |
| 5 | S-04 | 인연 그리드 (케미피드) | `ScreenFeed` (`screens-feed.jsx`) | `/(app)/feed` | `relations` table | 1 |
| 6 | S-05 | 인연 등록 / 편집 | `IRelName`, `IRelDob`, `IRelMode` | `/(app)/relation/new` steps 2-4 | `relations` table, fortune-core | 1 |
| 7 | S-06 | 관계 선택 진입 + 6모드 | `IRelMode` | `/(app)/relation/new/mode` | — | 1 |
| 8 | **S-07** | **합보기 케미카드** ⭐ | `IHapcard`, `IHapcardExpand` (sheet) | `/(app)/feed/[relationId]/result` | fortune-core compat + GPT-5 stream | 1 |
| 9 | S-08 | 이런건어때 시트 | Drawer overlay | Sheet on `/(app)/today` or `/(app)/feed` | — | 1 |
| 10 | S-08-T | 명리 용어 툴팁 시스템 | — (not in prototype) | Global component | — | 1 |
| 11 | S-96 | 공유케미카드 (1-2종 MVP) | `ScreenShareCard` (`screens-result.jsx`) | `next/og` API route | hapcard data | 1 |
| 12 | S-97 | 푸시 알림 카드 + 옵트인 토글 (D+1) | `ScreenNotif` (`screens-feed.jsx`) | Push notification payload | Web Push API | 1 |
| 13 | S-98 | 결제 / 충전 / 구독 | `IPaywall` | `/(app)/paywall` | 토스페이먼츠 SDK | 1 |
| 14 | S-99 | 에러 / 로딩 / 오프라인 / 빈 상태 | — (not in prototype) | `components/feedback/` global | — | 1 |

### 5.2 Phase 1.5 (4 weeks post-launch)

| ID | Name | Route | Phase |
|---|---|---|---|
| S-09 | 인연 디테일 + 타임라인 뷰 | `/(app)/feed/[relationId]` | 1.5 |
| S-10 | 합흐름 그래프 (라인 차트) | Tab inside S-09 | 1.5 |
| S-10-A | 영역별 미니 레이더 (케미카드 [8]) | Hapcard expand tab | 1.5 |
| S-11 | 합메모 입력 모듈 (80자) | Sheet on S-07 footer | 1.5 |
| S-97 D+7/D+30 | 푸시 알림 D+7/D+30 추가 | Push notification | 1.5 |
| 케미 다시 맞추기 변형 | 케미카드 배지 + 다이프 인디케이터 | S-07 variant | 1.5 |
| S-96 5종 | 공유케미카드 5종 완성 | `next/og` variants | 1.5 |
| S-04-A | 케미피드 자동 정렬 + 흐름 배지 | S-04 variant | 1.5 |
| S-97-B | 본인 운기 변화 → 인연 영향 푸시 | Push notification | 1.5 |
| S-07-A | 케미카드 [5] 변화 폭 인디케이터 | S-07 sub-component | 1.5 |

### 5.3 Phase 2

| ID | Name | Route |
|---|---|---|
| S-12 | 친구합 (Pair Quiz) | `/(app)/pair-quiz` |
| S-13 | 딥합 6종 (월간/분기/연/이직/연애/재물) | `/(app)/deep/[type]` |
| S-14 | 상황 컨텍스트 selector (6옵션) | Sheet on S-07 |
| S-15 | 시즌 큐레이션 카드 | S-08 section |
| S-16 | iOS/Android 홈스크린 위젯 | PWA manifest + widget API |
| S-17 | 합맵 + 찰떡합 | `/(app)/feed?view=map` |
| S-17-A | 네트워크 뷰 인연 간 유사성·반대성 | S-17 sub-view |
| S-18 | 상황별 공유케미카드 변형 | `next/og` variants |
| S-19 | 명리 학습 카드 시리즈 | S-08 section |
| — | 카카오 OAuth 진입 | `/(auth)/kakao/callback` |

### 5.4 Phase 3 (SEA — vi/th, 16 weeks post-launch)

- vi/th 2개 언어 i18n (`messages/vi.json`, `messages/th.json`)
- Noto Sans VI / Noto Sans Thai loaded via `next/font`
- 일주 표기 토글: 한자 / 한글 음역 / vi·th 현지 음역
- 시즌 캘린더: 베트남 Tết + 태국 Songkran

### 5.5 Phase 4

- ms/id 언어 추가
- 싱가포르·말레이시아·인도네시아 카피 가이드라인
- 화교 + 무슬림 다양성 고려 (중문/영문 병행 표기 검토)

---

## 6. Routing & navigation

### 6.1 Prototype router → Next.js

The prototype (`interactive.jsx`) implements a stack-based router with:
- `push(route, params)` — adds to stack
- `pop()` — removes top
- `replace(route)` — resets stack
- `openSheet(route, params)` — opens bottom sheet
- `closeSheet()` — closes sheet

Production mapping:

| Prototype router action | Next.js equivalent |
|---|---|
| `push('hapcard', { id })` | `router.push('/feed/${id}/result')` |
| `pop()` | `router.back()` |
| `replace('home')` | `router.replace('/today')` |
| `openSheet('hapcard_expand')` | `Drawer` (vaul) open state in Zustand `ui.ts` |
| `closeSheet()` | Zustand close + `router.back()` if URL-synced |

### 6.2 iOS push/pop animation (360ms)

The prototype animates stack transitions with push/push-active/pop/pop-active
CSS classes over 360ms. Production: use **CSS View Transitions API**
(`document.startViewTransition`) on supported browsers. Fallback: static
page transition (no animation). Do NOT replicate the prototype's
`RouterStack` in React — Next.js handles history.

```css
/* globals.css — view transition slide */
::view-transition-old(root) { animation: slide-out 360ms ease; }
::view-transition-new(root) { animation: slide-in 360ms ease; }
@keyframes slide-in  { from { transform: translateX(100%) } to { transform: translateX(0) } }
@keyframes slide-out { from { transform: translateX(0) }    to { transform: translateX(-30%) } }
```

### 6.3 Swipe-back

Prototype: touch start on left edge (x < 30px), commit at 80px drag.
Production: **drop custom swipe-back**. On iOS Safari PWA the native
gesture handles it. On Android TWA the system back button handles it.
No custom implementation needed.

### 6.4 Bottom tab bar navigation

`/(app)/layout.tsx` renders a fixed-bottom `<TabBar>` component. Tab
active state reads from `usePathname()`:

```
/today       → 홈 tab active
/feed/**     → 케미피드 tab active
/profile     → 내 프로필 tab active
```

이런건어때 sheet: triggered from within the tab bar (fourth slot or
FAB-style button above the bar), opens as vaul `Drawer`.

### 6.5 Prototype routes → App Router map

| Interactive route key | Screen | App Router path |
|---|---|---|
| `splash` | 앱 로고 + 시작하기 | `/(marketing)` |
| `onboard` | 3-slide carousel | `/(marketing)/onboard` |
| `birth_dob` | 생년월일 캘린더 트레이 | Multi-step in `/(app)/relation/new` |
| `birth_time` | 태어난 시 휠피커 | Same step |
| `birth_cal` | 양/음력 선택 | Same step |
| `birth_review` | 본명식 미리보기 | Same step |
| `home` | 오늘의 합 | `/(app)/today` |
| `hapcard` | 케미카드 Liquid Glass hero | `/(app)/feed/[relationId]/result` |
| `hapcard_expand` (sheet) | 케미카드 5탭 펼침 | Drawer on same page |
| `rel_name` | 인연 별명 입력 | Step 1 in `/(app)/relation/new` |
| `rel_dob` | 인연 생일 입력 | Step 2 |
| `rel_mode` | 6모드 선택 | `/(app)/relation/new/mode` |
| `paywall` | 8p 페이월 | Drawer or `/(app)/paywall` |

---

## 7. State management

### 7.1 Zustand stores (client UI state)

Port these directly from the prototype's global stores:

**`stores/lang.ts`** — lifted from `__hapLangStore` in `i18n.jsx`
```ts
// Behavior: persist locale to cookie (not localStorage — for SSR)
// next-intl reads locale from cookie on server
interface LangStore { lang: Locale; setLang: (l: Locale) => void }
```

**`stores/theme.ts`** — lifted from `__hapThemeStore` in `i18n.jsx`
```ts
// next-themes handles persistence; Zustand store for components
// that need theme without useTheme() coupling
interface ThemeStore { theme: 'light' | 'dark'; setTheme: (t: ThemeStore['theme']) => void }
```

**`stores/ui.ts`** — lifted from `TWEAK_DEFAULTS` in `app.jsx`
```ts
interface UiStore {
  sheetOpen: string | null;     // which sheet is open
  onboardStep: number;          // relation registration step
  density: number;              // design system density tweak
  radius: number;               // border radius scale
}
```

### 7.2 TanStack Query (server state)

Cache key conventions:

| Data | Query key | Invalidation trigger |
|---|---|---|
| All relations | `['relations']` | After `createRelation` |
| Single relation | `['relation', relationId]` | After update/delete |
| Hapcard result | `['hapcard', relationId, mode]` | After new hapcard created |
| Today's hap | `['today-hap']` | Daily at midnight KST |
| User profile | `['user-profile']` | After onboarding complete |
| Daily quota | `['quota']` | After hapcard consumed |

### 7.3 Form state

Multi-step relation registration (S-01-A → S-05 → S-06): use
**React Hook Form** + **Zod**. Schema in `types/relation.ts`:

```ts
const RelationCreateSchema = z.object({
  nickname: z.string().min(1).max(20),     // 별명만, 실명 금지
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  birthHour: z.number().min(0).max(23).optional(),
  isLunar: z.boolean(),
  gender: z.enum(['male', 'female']),
  mode: z.enum(['일합', '친구합', '돈합', '첫합', '썸합', '오래합']),
});
```

Step data persists in Zustand `ui.ts` between route changes (avoid losing
data on navigation). Submit on final step only.

---

## 8. i18n migration — `UIDesign/i18n.jsx` → next-intl

### 8.1 Key extraction

`I18N_DICT` in `i18n.jsx` maps directly to `messages/ko.json` and
`messages/en.json`. All 80+ keys lift verbatim.

Key groups:
- `common.*` — navigation labels, shared actions
- `app.*` — brand name, tagline
- `onb.*` — onboarding steps
- `home.*` — today tab, tab bar labels
- `rel.*` — relation registration, 6-mode labels
- `res.*` — hapcard result, expansion tabs, area labels
- `feed.*` — feed tab, filter chips, D+1 alert
- `pw.*` — paywall chips, CTAs, balance display

Add missing keys from PRD §8 (error messages, loading states, empty
states) to both locale files before Phase 1 launch.

PRD §8.1 error codes → i18n keys (add to both locale files):

| Code | Korean copy | i18n key |
|---|---|---|
| `CALC_FAIL` | "사주 계산에 실패했어요. 생년월일시를 한 번 더 확인해주세요." | `error.calc_fail` |
| `CALC_UNKNOWN_TIME` | "정확한 시간이 없다면 시나리오 추정으로 볼 수 있어요." | `error.calc_unknown_time` |
| `LLM_TIMEOUT` | "AI가 많이 생각 중이에요. 잠시 후 다시 시도해주세요." | `error.llm_timeout` |
| `LLM_RATE_LIMIT` | "지금 이용자가 많아요. 1~2분 뒤 다시 시도해주세요." | `error.llm_rate_limit` |
| `LLM_BANNED_OUTPUT` | "답변 품질이 기준을 못 채웠어요. 다시 시도할게요." | `error.llm_banned_output` |
| `USER_QUOTA_EXCEEDED` | "오늘의 질문 한도를 다 쓰셨어요. 내일 자정에 초기화됩니다." | `error.user_quota_exceeded` |
| `IP_RATE_LIMIT` | "너무 자주 시도하고 있어요. 1분 후 다시 해주세요." | `error.ip_rate_limit` |
| `NETWORK_OFFLINE` | "인터넷 연결이 끊어졌어요. 마지막 결과는 확인할 수 있어요." | `error.network_offline` |

### 8.2 Provider setup

```ts
// app/layout.tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

export default async function RootLayout({ children, params: { locale } }) {
  const messages = await getMessages();
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

Locale persists via cookie (server-readable), not localStorage. The
prototype uses `localStorage.setItem('hap-lang')` — replace with
`cookies().set('NEXT_LOCALE', lang)` via a Server Action.

### 8.3 Phase 3 fonts

Load per locale in `app/layout.tsx`:

```ts
const notoSansVI = Noto_Sans({ subsets: ['vietnamese'], variable: '--font-body-vi' });
const notoSansTH = Noto_Sans_Thai({ variable: '--font-body-th' });
```

Apply via `<html className={locale === 'vi' ? notoSansVI.variable : ...}>`.

### 8.4 Copy length budget (PRD §7.6)

vi/th/id/ms translations run ~30% longer than Korean. Never use
fixed-width containers for primary copy. CTA buttons: use `min-w` not
`w-[fixed]`. Tab labels: allow wrapping or truncate with `truncate` +
`title` attribute.

---

## 9. Theme & dark mode

```ts
// tailwind.config.ts
export default {
  darkMode: ['class'],  // .dark on <html>
  // ...
}
```

`globals.css` structure:

```css
:root {
  /* light mode tokens */
  --p-40: #6750A4;
  --bg-canvas: #FBF8F3;
  /* ... all tokens ... */
}

.dark {
  /* dark mode token overrides */
  --p-40: #CFBCFF;
  --bg-canvas: #14151C;
  /* ... */
}
```

`next-themes` with `defaultTheme="system"` syncs with
`prefers-color-scheme`. Zustand `themeStore` mirrors the current theme for
components that can't use `useTheme()`.

PRD §7.5: all animations respect `prefers-reduced-motion`:
```css
@media (prefers-reduced-motion: reduce) {
  *, ::view-transition-old(root), ::view-transition-new(root) {
    animation-duration: 0.01ms !important;
  }
}
```

---

## 10. Hapcard composition — S-07 (PRD §6)

The hapcard is the product's single most important artifact. PRD §6 defines
8 components with specific viewport priority (ADR-026).

### 10.1 First-paint components (above fold)

| # | Component | Production name | Source |
|---|---|---|---|
| [1] | Header — 양쪽 일주 chip + 오행 컬러 | `<HapcardHeader>` | `ScreenHapcardHero` in `screens-result.jsx` |
| [2] | 합게이지 — 0-100 원형, 4구간 라벨 | `<CompatGauge>` | Partial in hero; build custom SVG arc |
| [4] | 본문 3섹션 — 결론 150자 + 강점 + 주의점 + 일단이거해봐 3 | `<HapcardBody>` | **Not in prototype** — build new |
| [6] | 푸터 — D+1 알림 / 메모 80자 / 공유 CTA | `<HapcardFooter>` | Partial in `ScreenAction` |

### 10.2 Scroll / expand components

| # | Component | Production name | Source | Default |
|---|---|---|---|---|
| [3] | 오행맵 — 5각형 본인(실선) + 인연(점선) | `<OhaengMap>` | `Ohaeng` + `Radar` primitives | Scroll reveal |
| [5] | 근거 보기 — 명리 + 고전 원문 + 현대어 번역 | `<EvidenceAccordion>` | **Not in prototype** — build new | Collapsed |
| [7] | 명리 용어 ⓘ 툴팁 + 바텀시트 + 쉽게 보기 토글 | `<TermTooltip>` | **Not in prototype** — build new | Auto-show on first view |
| [8] | 영역별 미니 레이더 4축 (Phase 1.5) | `<AreaRadar>` | `ScreenHapcardRadar` | Collapsed |

### 10.3 HapcardBody (LLM streaming)

PRD §6 ADR-034: first-screen copy 150자 이내 (결론·강점·주의점·일단이거해봐 3),
"자세히 보기" expands to 400-600자. Text streams in.

```ts
// app/api/hapcard/route.ts
export async function POST(req: Request) {
  const body = await req.json();
  // PII-safe payload per tech_stack.md §3.5:
  // { chart_core, question_slot, theory_profile.profile_version }
  // Never send birth_date / name / email / birth_place
  const stream = await openai.chat.completions.create({
    model: 'gpt-5',
    stream: true,
    messages: buildPrompt(body),
  });
  return new Response(stream.toReadableStream());
}
```

Client: use TanStack Query's `useQuery` with `staleTime: Infinity` (results
are cached 30 days per tech_stack.md §7.2). Stream text via
`ReadableStream` + React `useState` append.

### 10.4 합게이지 design spec (PRD §6.2)

4-segment color gradient:
- 0-39: weak (gray)
- 40-59: 보통 (yellow)
- 60-79: 좋음 (green)
- 80-100: 매우 좋음 (purple primary)

Custom SVG arc; no Recharts (too heavy for a simple gauge). Integer score
only. KR/EN labels via `t('res.score_label')`.

### 10.5 시나리오 추정 모드 (PRD §6.5)

When birth hour is unknown → fortune-core runs 12-scenario average.
Hapcard shows:
- Badge on header [1]: "시나리오 추정 모드" with gradient background
- Score [2] with inline confidence interval (e.g., "73 ±9")
- Body copy avoids "정확히/확실히/반드시" (auto-filter in prompt)

### 10.6 케미카드 route composition

```
app/(app)/feed/[relationId]/result/
├─ page.tsx         # Server Component — fetch hapcard data, stream body
├─ HapcardHeader.tsx
├─ CompatGauge.tsx
├─ HapcardBody.tsx  # Client Component — streaming text display
├─ OhaengMap.tsx
├─ EvidenceAccordion.tsx
├─ HapcardFooter.tsx
└─ TermTooltip.tsx  # Global, portal-rendered
```

---

## 11. Server actions & data flow

### 11.1 Phase 1 critical paths

**S-05 인연 등록 (`createRelation`)**
```
Client form submit
  → Server Action: createRelation(RelationCreateInput)
  → fortune-core: calcIlju(birthDate, birthHour, isLunar, gender) → chart_core
  → Supabase INSERT relations { user_id, nickname, chart_core, mode, created_at }
  → Return relation id
  → router.push('/feed/[id]/result')
```

**S-07 케미카드 생성 (`createHapcard`)**
```
Page load for /feed/[relationId]/result
  → TanStack Query: check ['hapcard', relationId, mode]
  → Cache miss → POST /api/hapcard
  → Server: fortune-core compatScore(userChart, relationChart)
  → Server: OpenAI GPT-5 stream (PII-safe payload only)
  → Stream text to client HapcardBody
  → Supabase INSERT hapcard_results { relation_id, score, mode, created_at }
  → Cache result 30 days (tech_stack §7.2)
```

**S-03 오늘 케미 (`getTodayHap`)**
```
Daily cron (GitHub Actions 08:00 KST)
  → For each user: fortune-core dailyScore(userChart, today)
  → GPT-5 mini prompt (1,500 tokens in / 300 out)
  → Supabase UPSERT daily_hap { user_id, date_kst, score, summary }
Client load:
  → TanStack Query ['today-hap'] → fetch from daily_hap
```

### 11.2 PII/ZDR policy (single source: `docs/legal/pii_minimization.md`)

The following 6 fields MUST NEVER appear in any LLM API payload:

`birth_date` (raw), `name`, `nickname`, `email`, `birth_place`, `gender` (raw)

LLM payloads are restricted to `chart_core + question_slot + theory_profile.profile_version`. ZDR contract required for OpenAI and Anthropic. Violations block PR and trigger CLAUDE.md §1.1 user report.

See `docs/legal/pii_minimization.md` for full taxonomy and rationale.

---

## 12. Performance & PWA

### 12.1 Lighthouse targets

| Metric | Target | Screen |
|---|---|---|
| LCP | < 2.5s | hapcard (S-07) first paint |
| CLS | < 0.1 | Skeleton heights == real content (PRD §8.2) |
| FID/INP | < 200ms | Mode selector (S-06) tap response |

Skeleton strategy: every server-rendered section with unknown height must
have a `<Skeleton className="h-[exact-px]">` that matches the eventual
content height. Do not use generic spinners on content that has known
dimensions.

### 12.2 Font loading

```ts
// app/layout.tsx — NOT the CDN @import from prototype
import localFont from 'next/font/local';
const pretendard = localFont({
  src: '../public/fonts/PretendardJP-Variable.woff2',
  variable: '--font-display',
  display: 'swap',
});
```

### 12.3 PWA

- Manifest: `app/manifest.ts` — `display: 'standalone'`, `theme_color: '#6750A4'`
- Service worker: app shell cached, hapcard result pages cached for offline
- NETWORK_OFFLINE: top-fixed banner from `error.network_offline` i18n key

### 12.4 Hapcard share image

```ts
// app/api/og/hapcard/route.tsx
import { ImageResponse } from 'next/og';
// Renders OG image with: score, nickname chips, 5-element summary
// PRD §8: S-96 공유케미카드 — 표시 범위 사용자 선택 (별명만 / 별명+오행 / 별명+성별)
```

### 12.5 TWA (Android)

Bubblewrap config per ADR-031. Separate from Next.js build; keep in
`/twa/` directory. TWA verification domain: match Supabase auth origin.

---

## 13. Accessibility (WCAG 2.2)

All shadcn/ui components ship with Radix primitives, which are WCAG 2.2
compliant (keyboard nav, ARIA, focus management).

Additional requirements:

| Requirement | Implementation |
|---|---|
| `prefers-reduced-motion` | Disable view transitions, streaming text, card-flip (PRD §7.5) |
| Dynamic type 100-200% | All font sizes in `rem` — no `px` after token migration |
| Color contrast | Verify `--p-40` (#6750A4) on `--surface-1` (#F7F2FA) at 14px → must pass AA (4.5:1). Use Figma contrast checker or `colorjs`. |
| Touch targets | 44×44px minimum (PRD AppBar ic-btn, TabBar items) |
| 케미카드 [7] 명리 용어 | First appearance: auto-announce via `aria-live="polite"`. Re-call via ⓘ button with `aria-expanded`. |

---

## 14. Error / loading / empty states (PRD §8)

### 14.1 ErrorCard component

```tsx
// components/feedback/ErrorCard.tsx
type ErrorVariant = 'CALC_FAIL' | 'CALC_UNKNOWN_TIME' | 'LLM_TIMEOUT' |
  'LLM_RATE_LIMIT' | 'LLM_BANNED_OUTPUT' | 'USER_QUOTA_EXCEEDED' |
  'IP_RATE_LIMIT' | 'NETWORK_OFFLINE';

interface ErrorCardProps { variant: ErrorVariant; onRetry?: () => void }
```

Each variant maps to `t('error.' + variant.toLowerCase())` and a specific
UI from PRD §8.1:

| Variant | UI pattern |
|---|---|
| `CALC_FAIL` | Inline card + [다시 시도] |
| `CALC_UNKNOWN_TIME` | Modal + [시나리오 추정 보기] / [시간 추가] |
| `LLM_TIMEOUT` | Top banner on result page |
| `LLM_RATE_LIMIT` | Toast |
| `LLM_BANNED_OUTPUT` | Auto-retry progress bar |
| `USER_QUOTA_EXCEEDED` | Full-screen + [충전] CTA |
| `IP_RATE_LIMIT` | Toast |
| `NETWORK_OFFLINE` | Sticky top banner (persists while offline) |

### 14.2 Loading states (PRD §8.2)

```ts
// Orchestrate with TanStack Query + useEffect timer
const { data, isLoading } = useQuery({ queryKey: ['hapcard', id, mode] });
const [phase, setPhase] = useState<'loading' | 'slow' | 'timeout'>('loading');

useEffect(() => {
  if (!isLoading) return;
  const slow = setTimeout(() => setPhase('slow'), 10_000);   // "조금 더 걸리고 있어요"
  const out  = setTimeout(() => setPhase('timeout'), 20_000); // LLM_TIMEOUT
  return () => { clearTimeout(slow); clearTimeout(out); };
}, [isLoading]);
```

Skeleton heights must match real content exactly (CLS < 0.1).

### 14.3 Empty states

S-04 (인연 그리드) first visit (PRD §8.4):
- Illustration (gradient mesh blob — Notion/Linear tone, no 별·달·타로)
- Copy: `t('feed.empty.title')` = "첫 인연을 기록해보세요"
- Sub-copy: "첫 합보기 1회 + 내일 케미 다시 맞추기 1회가 무료로 준비되어 있어요"
- CTA: `<Button className="w-full">` → `router.push('/relation/new')`

---

## 15. Testing strategy

### 15.1 Vitest (unit)

- `lib/saju/*.test.ts`: fortune-core deterministic outputs (same input → same 일주, same compatibility score)
- `messages/*.test.ts`: all keys present in both `ko.json` and `en.json`; no key exists in one but not the other
- `types/*.test.ts`: Zod schema parse round-trips for every contract type

### 15.2 Playwright (E2E)

Three critical flows from PRD §4:

**Flow A — 신규 가입자 첫 5분** (happy path + CALC_FAIL error)
```
/ → /onboard → /relation/new (별명 입력) → (별명+생일 입력) →
/relation/new/mode → /feed/[id]/result (케미카드 로드) → hapcard body visible
```

**Flow B — 일상 리텐션** (오늘 케미 → D+1 알림)
```
/today (오늘 케미 score visible) → click notification card → /feed/[id]/result
```

**Flow C — 결정 지원** (이런건어때 → 합보기)
```
/today → open 이런건어때 sheet → select 진단 → /feed/[id]/result
```

### 15.3 Zod validation points

- Every Server Action input
- Every Supabase row read (`from('relations').select()` result)
- Every OpenAI response body before storing

---

## 16. Work order (recommended)

1. **Tokens & theme** — port `system.css` → `tailwind.config.ts` + `globals.css`. Verify light/dark on a single test page. Check `--p-40` contrast ratios.

2. **Primitives** — `shadcn add button badge dialog drawer popover accordion toggle-group progress`. Port custom: `AppBar`, `TabBar`, `OhaengMap`, `Radar`, `Timeline`, `LiquidHero`, `Chip` with element prop.

3. **Layouts** — `app/layout.tsx` (root: font, providers), `app/(app)/layout.tsx` (bottom TabBar, auth guard), `app/(marketing)/layout.tsx` (no TabBar).

4. **i18n + theme bootstrap** — next-intl provider, next-themes, Zustand stores (`lang.ts`, `theme.ts`, `ui.ts`).

5. **Contracts** — write all `types/*.ts` Zod schemas. Run `tsc --noEmit`.

6. **Phase 1 MVP screens in PRD priority order:**
   - S-01-A + S-05: relation registration multi-step form
   - S-06: 6-mode selector
   - S-07: hapcard page (static first, then streaming)
   - S-04: relation grid + empty state
   - S-03: today tab
   - S-99: error / loading / empty components
   - S-96: share OG image (1-2 variants)
   - S-08: 이런건어때 sheet (entry cards only)

7. **Hapcard 8-component build** — assemble [1][2][4][6] for Phase 1; [3][5][7] as Phase 1 but post-launch priority; [8] Phase 1.5.

8. **Supabase wiring** — schema, RLS policies, Server Actions, ZDR-safe OpenAI calls.

9. **PWA + TWA** — manifest, service worker, Bubblewrap.

10. **Phase 1.5** — timeline, graph, mini radar, memo, opt-in push, 케미 다시 맞추기 변형.

11. **Phase 2** — Pair Quiz, 딥합, 합맵, widgets.

12. **Phase 3** — vi/th i18n, Noto Sans, 일주 표기 토글, Tết/Songkran.

13. **Phase 4** — ms/id, 화교/무슬림 카피.

---

## 17. Gaps — prototype does NOT cover these

These must be built from scratch for production. Each is a flag to the
developer: build new or get a design reference from the designer.

| Gap | PRD reference | Complexity |
|---|---|---|
| Hapcard [4] body 3-section LLM streaming UI (150자 summary + expand 400-600자) | §6.2 | High — streaming + CLS management |
| Hapcard [5] 근거 보기 with 고전 원문 + 현대어 번역 병기 (0-2건) | §6.2 | Medium |
| Hapcard [7] 명리 용어 ⓘ 툴팁 + 쉽게 보기 토글 (ADR-023) | §6.2, S-08-T | High — global, shared across hapcard/진단/리포트 |
| 시나리오 추정 모드 배지 + 신뢰 구간 (±점수) | §6.5 | Medium |
| S-96 공유케미카드 표시 범위 사용자 선택 모듈 | §5.1 | Medium |
| S-99 에러 카드 8종 시각 | §8.1 | Low |
| S-97 D+1 푸시 카드 Web Push integration | §5.1 | Medium |
| S-98 토스페이먼츠 결제 시트 (ADR-005) | §5.1 | High |
| 케미피드 그리드 자동 정렬 + 흐름 배지 (S-04-A, ADR-033) | §5.2 | Medium — Phase 1.5 |
| S-12 친구합 (Pair Quiz) — deep link share flow | §5.3 | High — Phase 2 |

### Open questions from MEMORY.md (R1-R7)

The following product questions are unresolved. Do not make assumptions in
code — wait for decisions before implementing the affected areas:

| ID | Question | Decision by |
|---|---|---|
| R1 | 모르는사람 모드 정의 (already removed per ADR-025, absorbed by "첫만남 플레이") | Confirmed — implement Track B |
| R2-R7 | See `MEMORY.md` project_open_questions.md | Phase-specific milestones |

---

## 18. Verification checklist

Run through this after scaffolding and again after each phase ships:

1. `pnpm create next-app --typescript` + apply folder structure from §2 → all directories exist.
2. Open `tailwind.config.ts` → every token table row in §3 has a corresponding key.
3. `pnpm dlx shadcn@latest add button badge dialog drawer popover accordion toggle-group progress` → all components installed in `components/ui/`.
4. Build `<HapcardHeader>` with `<Chip element="wood">` → renders in element green, dark mode renders dark-mode green.
5. Open `app/(app)/feed/page.tsx` with mock empty relations list → empty state illustration + CTA renders (§14.3).
6. `next-intl` resolves `t('error.calc_fail')` in both `ko` and `en` → correct copy appears.
7. `tsc --noEmit` passes with zero errors — confirms contracts-first rule.
8. Lighthouse on `/feed/[id]/result` (hapcard): Performance ≥ 90, Accessibility ≥ 95, CLS < 0.1.
9. Toggle `prefers-reduced-motion` in DevTools → all animations pause (no view transitions, no streaming text fade).
10. Rotate to dark mode → all token variables resolve; no hard-coded hex values in component JSX.

---

*This document derives from: `UIDesign/` (12 prototype files), `PRD.md`, `tech_stack.md`, and ADRs cited inline. Do not modify `UIDesign/` files — they are the reference prototype. All production code lives in the new Next.js project.*

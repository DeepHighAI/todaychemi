# i18n Key Convention Spec

> 라이브러리: `next-intl`. 번역 파일 위치: `messages/<locale>.json`.
> 1차 언어: KO (기준). 추가 언어: EN(Phase 1), VI/TH(Phase 3 SEA), MS/ID(Phase 4).
> AGENTS.md §4 tech stack 잠금.

---

## 1. 8개 키 그룹

| 그룹 | 네임스페이스 | 용도 |
|---|---|---|
| `common.*` | 공통 UI | 버튼, 토스트, 레이블, 상태 메시지 |
| `app.*` | 앱 메타 | 타이틀, 설명, 에러 바운더리 |
| `onb.*` | 온보딩 | 가입 흐름, 사주 입력, 튜토리얼 |
| `home.*` | 홈 화면 | 오늘합 카드, 네비게이션, 배너 |
| `rel.*` | 인연 관리 | 인연 추가/수정/삭제, 피드 |
| `res.*` | 결과 화면 | 합카드, 딥합, 점수 컴포넌트 |
| `feed.*` | 합피드 | 인연 그리드, 필터, 정렬 |
| `pw.*` | 결제/포인트 | 충전, 구매, 영수증, 환불 |

---

## 2. 네이밍 규칙

### 기본 규칙

- **snake_case** + **점(.) 구분자**: `rel.create_nickname_placeholder`
- 최대 3단계 깊이: `<group>.<component>.<element>`
- 동사형 키는 동사를 앞에: `common.delete_confirm`, `common.retry_action`
- 상태 메시지: `_loading`, `_error`, `_empty`, `_success` 접미사

### 금지 패턴

```
common.nicknameLabel     (camelCase 금지)
rel-create-nickname      (하이픈 구분자 금지)
button.create            (그룹 없는 최상위 공통 키 금지)
common.settings          (AGENTS.md terminology: 'config' 사용, 'settings' 금지)
```

### 예시

```json
{
  "common": {
    "delete_confirm": "삭제하시겠어요?",
    "delete_label": "삭제",
    "retry_action": "다시 시도",
    "cancel": "취소",
    "save": "저장",
    "loading": "불러오는 중...",
    "error_generic": "오류가 발생했어요."
  },
  "rel": {
    "create_nickname_label": "별명",
    "create_nickname_placeholder": "인연의 별명을 입력하세요",
    "create_birth_date_label": "생년월일",
    "list_empty": "아직 등록된 인연이 없어요.",
    "archive_confirm": "이 인연을 숨기시겠어요?",
    "feed_filter_mode": "모드 필터"
  }
}
```

---

## 3. ICU MessageFormat — 복수형 + 변수

### 변수 삽입

```json
{
  "res": {
    "hapcard_score_label": "{nickname}과의 합점수",
    "hapcard_expires_notice": "{days}일 후 만료",
    "today_hap_greeting": "오늘 {nickname}과의 하루"
  }
}
```

사용:

```typescript
const t = useTranslations('res');
t('hapcard_score_label', { nickname: '연인' });
// → "연인과의 합점수"
```

### 복수형 (ICU plural)

```json
{
  "pw": {
    "token_balance": "{count, plural, =0 {포인트 없음} one {# 포인트} other {# 포인트}}",
    "relation_count": "{count, plural, =0 {인연 없음} one {인연 # 명} other {인연 # 명}}"
  }
}
```

사용:

```typescript
t('token_balance', { count: 30 });
// KO → "30 포인트"
// EN → "30 points"
```

### select (조건 분기)

```json
{
  "onb": {
    "gender_select": "{gender, select, 남 {남성} 여 {여성} other {미입력}}"
  }
}
```

---

## 4. +30% 길이 예산

번역 시 KO 대비 +30% 공간 확보 필수. 레이아웃 설계 기준:

| KO 문자수 | 레이아웃 예약 문자수 |
|---|---|
| 10자 | 13자 |
| 20자 | 26자 |
| 50자 | 65자 |

이유: EN/VI/TH는 평균 KO 대비 1.2–1.4배 길이. 버튼·카드 고정폭 레이아웃에서 overflow 방지.

```css
/* Tailwind: 텍스트 오버플로우 방지 */
.i18n-text {
  @apply truncate overflow-hidden;
}
/* 혹은 줄 바꿈 허용 */
.i18n-text-wrap {
  @apply break-words;
}
```

---

## 5. Phase별 언어 롤아웃

| Phase | 언어 | 조건 |
|---|---|---|
| Phase 1 | KO, EN | 스캐폴드 완료 후 기본 포함 |
| Phase 3 (SEA gate) | VI (베트남어), TH (태국어) | SEA 진입 게이트 통과 후 (`project_open_questions.md` R-항목) |
| Phase 4 | MS (말레이어), ID (인도네시아어) | Phase 3 KPI 달성 후 |

### next-intl 라우팅 설정 (Phase 1)

```typescript
// future proxy/middleware routing entry
import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['ko', 'en'],    // Phase 1: KO + EN
  defaultLocale: 'ko',
  localeDetection: true,    // Accept-Language 헤더 기준 자동 감지
});

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
```

Phase 3 확장 시 `locales`에 `'vi', 'th'` 추가. 미결정 SEA 계획은 `project_open_questions.md` 참조.

---

## 6. 번역 파일 구조

```
messages/
├─ ko.json      # 기준 언어 (KO) — 모든 키 필수 포함
├─ en.json      # Phase 1
├─ vi.json      # Phase 3 (SEA)
├─ th.json      # Phase 3 (SEA)
├─ ms.json      # Phase 4
└─ id.json      # Phase 4
```

### 번역 누락 감지

```typescript
// next-intl: 번역 누락 시 KO fallback + 경고 로그
// next.config.ts
const withNextIntl = createNextIntlPlugin('./i18n.ts');

// i18n.ts
export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`../messages/${locale}.json`)).default,
  onError(error) {
    // 개발: 콘솔 경고, 운영: Sentry 리포트
    if (process.env.NODE_ENV === 'production') {
      Sentry.captureException(error);
    } else {
      console.warn('[i18n] Missing translation:', error);
    }
  },
  getMessageFallback({ namespace, key }) {
    return `${namespace}.${key}`;  // fallback: 키 이름 표시
  },
}));
```

---

## 7. 번역 워크플로우

1. KO 기준 키 추가 → `messages/ko.json` 업데이트
2. EN 번역 즉시 추가 → `messages/en.json` (Phase 1 필수)
3. PR 리뷰 시 번역 누락 여부 확인 (CI에 i18n-lint 추가 예정)
4. VI/TH 번역은 Phase 3 직전 전문 번역가 의뢰
5. 번역 승인 후 `locales` 배열 추가 → Vercel 재배포

### 키 추가 체크리스트

- [ ] `ko.json`에 키 추가
- [ ] `en.json`에 EN 번역 추가
- [ ] 변수/복수형 있는 경우 ICU MessageFormat 사용 확인
- [ ] +30% 길이 예산 레이아웃 테스트 (`/browse` 스킬 EN 화면 확인)
- [ ] TypeScript 타입 안전성: `useTranslations('group')` 호출 확인

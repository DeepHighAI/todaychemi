# Contracts (types/) — 단일 truth source

> 본 문서는 `src/types/*.ts`의 코드 블록 truth source. 코드 변경 시 본 문서도 동시 갱신 (AGENTS.md §12 변경 매트릭스).
> Contracts-first rule: 인터페이스를 먼저 정의하고 구현. 본 문서가 게이트.

---

## Module Index

| File | Export key types | Depends on |
|---|---|---|
| `mode.ts` | `Mode`, `ModeSchema`, `MODE` | — |
| `relation.ts` | `RelationCreate`, `RelationRow` | — |
| `chart.ts` | `BirthData`, `ChartCore`, `ChartHash`, `TheoryProfile` | — |
| `hapcard.ts` | `HapcardResult`, `HapcardComponent` | `mode.ts` |
| `scoring.ts` | `ScoringInput`, `ScoringOutput`, `ScoringComponents` | `mode.ts`, `chart.ts` |
| `prompt.ts` | `PromptVersion`, `BannedPhraseHit`, `PromptStatus` | `mode.ts` |

> Import order rule (AGENTS.md style rules): external packages → `@/types/*` → relative. Never circular.

---

## mode.ts

```typescript
import { z } from 'zod';

// 6모드 상수 — ADR-010 단일 핵심 taxonomy 잠금
export const MODE = {
  ILHAP: '일합',
  CHINGUHAP: '친구합',
  DONHAP: '돈합',
  CHEOTHAP: '첫합',
  SSEOMHAP: '썸합',
  ORAEHAP: '오래합',
} as const;

export const ModeSchema = z.enum(['일합', '친구합', '돈합', '첫합', '썸합', '오래합']);
export type Mode = z.infer<typeof ModeSchema>;
```

---

## relation.ts

```typescript
import { z } from 'zod';

// 인연 생성 페이로드 — ADR-011 별명만 수집, 실명 수집 금지
export const RelationCreateSchema = z.object({
  nickname: z.string().min(1).max(20),
  gender: z.enum(['남', '여']),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  birth_time_known: z.boolean(),
  birth_hour: z.number().int().min(0).max(23).nullable(),
  birth_minute: z.number().int().min(0).max(59).nullable(),
  birth_calendar: z.enum(['solar', 'lunar']),
  relationship_tag: z.string().max(30).optional(),
});
export type RelationCreate = z.infer<typeof RelationCreateSchema>;

// DB row — Supabase relations 테이블과 1:1 대응
export interface RelationRow {
  id: string;
  user_id: string;
  nickname: string;
  gender: '남' | '여';
  birth_date: string;
  birth_time_known: boolean;
  birth_hour: number | null;
  birth_minute: number | null;
  birth_calendar: 'solar' | 'lunar';
  relationship_tag: string | null;
  created_at: string;
  archived_at: string | null;   // soft delete — ADR: delete = archived_at 설정
}
```

---

## chart.ts

```typescript
import { z } from 'zod';

// 생년월일 입력 — LLM 페이로드에 포함 금지 (AGENTS.md §5 PII)
export const BirthDataSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hour: z.number().int().min(0).max(23).nullable(),
  minute: z.number().int().min(0).max(59).nullable(),
  calendar: z.enum(['solar', 'lunar']),
  gender: z.enum(['남', '여']),
});
export type BirthData = z.infer<typeof BirthDataSchema>;

// 사주 핵심 — LLM에 보내도 되는 유일한 사주 데이터 (AGENTS.md §5)
export interface ChartCore {
  year_pillar: string;           // 예: "甲子"
  month_pillar: string;          // 예: "乙丑"
  day_pillar: string;            // 예: "丙寅" (일주 = ilju)
  hour_pillar: string | null;    // 시간 모를 경우 null
  day_master_element: '목' | '화' | '토' | '금' | '수';
  five_elements_counts: Record<'목' | '화' | '토' | '금' | '수', number>;
  gender_normalized: '남' | '여';
}

// SHA-256(BirthData 정규화 직렬화) — PII 없이 캐시 키로 사용
export type ChartHash = string;

// 만세력 이론 설정 — profile_version만 LLM 페이로드에 포함 (AGENTS.md §5)
export interface TheoryProfile {
  profile_version: string;           // 예: "v2.1.0"
  ja_si_mode: 'late_zi' | 'early_zi'; // 자시 기준 (23:00 vs 00:00)
  longitude_correction: boolean;     // 경도 보정 여부
}
```

---

## hapcard.ts

```typescript
import type { Mode } from './mode';

// ADR-016: 결과 카드 6 컴포넌트 Phase 1 잠금
export type HapcardComponent =
  | 'header'
  | 'gauge'
  | 'ohaeng_map'
  | 'body_3section'
  | 'evidence'
  | 'footer'
  | 'glossary'
  | 'mini_radar';

// 합카드 결과 — DB hapcard_results 테이블과 1:1 대응
export interface HapcardResult {
  id: string;
  user_id: string;
  relation_id: string;
  mode: Mode;
  prompt_version: string;
  scoring_version: number;
  score: number;                       // 결정형 점수 — ADR-035
  score_components: {
    hap_chung_hyung_hae: number;       // 합·형·충·해
    sipsin: number;                    // 십신
    ohaeng: number;                    // 오행
    mode_adjustment: number;           // 모드별 가중치
  };
  body_summary: string;                // LLM 생성 요약 (2–3문장)
  body_detail: string;                 // LLM 생성 상세 (3섹션)
  evidence: {
    sipsin_mappings: Array<{ name: string; effect: string }>;
    classics_quotes: Array<{           // ADR-004 고전 RAG
      source: string;
      original: string;
      modern: string;
    }>;
    daily_influences: {
      ilji: string;    // 일지
      jueun: string;   // 주운
      woolun: string;  // 우운
    };
  };
  viewport_priority: HapcardComponent[]; // 뷰포트 순서 힌트
  computed_at: string;
  expires_at: string;                  // 오늘합은 자정, 합카드는 28일
}
```

---

## scoring.ts

```typescript
import type { Mode } from './mode';
import type { ChartHash } from './chart';

// 점수 계산 입력 — 결정형 함수, LLM 개입 금지 (ADR-035)
export interface ScoringInput {
  user_chart_hash: ChartHash;
  relation_chart_hash: ChartHash;
  mode: Mode;
  scoring_version: number;
  ilji_date: string;    // 오늘합 날짜 (YYYY-MM-DD)
}

// 점수 컴포넌트
export interface ScoringComponents {
  hap_chung_hyung_hae: number;
  sipsin: number;
  ohaeng: number;
}

// 점수 계산 출력
export interface ScoringOutput {
  score: number;
  components: ScoringComponents;
  mode_adjustment: number;
  scenario_estimate: {
    is_estimated: boolean;             // 시나리오 추정 모드 여부
    display_score: number;             // 표시 점수
    display_range: number;             // 표시 범위 (±N)
    needs_badge: boolean;              // "추정" 뱃지 표시 여부
  } | null;
  scoring_version: number;
}
```

---

## prompt.ts

```typescript
import type { Mode } from './mode';

// 프롬프트 상태
export type PromptStatus = 'active' | 'canary' | 'rolled_back';

// 프롬프트 버전 — DB prompt_versions 테이블과 1:1 대응
export interface PromptVersion {
  id: string;
  mode: Mode;
  model_name:
    | 'gpt-5'
    | 'gpt-5o'
    | 'gpt-5-mini'
    | 'claude-fallback';
  version_label: string;             // 예: "hapcard-v2.1"
  prompt_text: string;
  banned_phrases_version: string;    // 금지 어구 코퍼스 버전
  canary_pct: number;                // 카나리 트래픽 비율 (0–100)
  status: PromptStatus;
  created_at: string;
}

// 금지 어구 히트 로그
export interface BannedPhraseHit {
  id: string;
  prompt_version_id: string;
  phrase: string;
  raw_output_excerpt: string;
  created_at: string;
}
```

---

## 변경 규칙

1. 이 문서 수정 없이 `src/types/*.ts` 직접 수정 금지
2. 수정 후 `pnpm tsc --noEmit` 통과 확인 (Contracts-first)
3. DB 스키마 영향 있을 경우 `docs/specs/db_schema.md` 동시 갱신 (AGENTS.md §12)
4. PII 필드 추가 시 AGENTS.md §5 검토 필수

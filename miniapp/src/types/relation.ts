/**
 * relation.ts — 인연/피드 타입 (웹앱 src/types/relation.ts 미니앱 포트)
 *
 * 웹앱 원본에서 Zod 스키마·DB Row는 제거하고 클라이언트 응답 타입만 유지.
 * miniapp 은 DB에 직접 접근하지 않으므로 Zod 검증 로직도 불필요.
 *
 * Mode 타입은 hapcard.ts 에서 재사용 (miniapp 에서는 별도 mode.ts 없음).
 * ChartCore 타입은 직접 인라인으로 최소 정의.
 */

// 6모드 타입 (웹앱 src/types/mode.ts, hapcard.ts 와 동일 집합)
export type Mode =
  | '일합'
  | '친구합'
  | '돈합'
  | '첫합'
  | '썸합'
  | '오래합';

// -----------------------------------------------------------------------
// 피드 응답 타입 (GET /api/feed)
// -----------------------------------------------------------------------

/**
 * 케미피드 카드 항목 — S-04 인연 목록 그리드 표시용 subset
 * (웹앱 src/types/relation.ts FeedListItem 과 동일 shape)
 */
export interface FeedListItem {
  relation_id: string;
  nickname: string;
  mode: Mode | null;
  created_at: string;
  compat_score?: number | null;
}

/** 인연 chip 드롭다운용 최소 항목 (RelationChip 에서 사용) */
export interface RelationChipItem {
  relation_id: string;
  nickname: string;
  mode: string | null;
  created_at: string;
}

/** Y4 ADR-036 — 케미피드 응답 항목 */
export interface FeedItem {
  relation_id: string;
  nickname: string;
  mode: Mode;
  compat_score: number | null;
  change_score: number;
  has_significant_change: boolean;
  created_at: string;
}

// -----------------------------------------------------------------------
// 인연 디테일 응답 타입 (GET /api/relations/[id])
// -----------------------------------------------------------------------

/** 합점수 흐름 포인트 */
export interface FlowPoint {
  date: string; // YYYY-MM-DD
  score: number;
}

/** GET /api/relations/[id] 응답 */
export interface RelationDetailResponse {
  relation: {
    relation_id: string;
    nickname: string;
    mode: Mode;
    created_at: string;
  };
  /** ChartCore 최소 subset — day_pillar 표시용 */
  chart: { day_pillar: string } | null;
  flow: FlowPoint[];
}

// -----------------------------------------------------------------------
// 인연 타임라인 응답 타입 (GET /api/relations/[id]/timeline)
// S-09 H-1: 메모 제외·최신순·v1 표시 전용
// -----------------------------------------------------------------------

export type RelationTimelineEventType = 'registered' | 'hapcard' | 'replay';

/** 메타데이터만 — 본문·점수 미포함 (ADR-039 read-path 비대상) */
export interface RelationTimelineEvent {
  type: RelationTimelineEventType;
  occurred_at: string; // timestamptz ISO
  mode: Mode | null;
}

/** GET /api/relations/[id]/timeline 응답 */
export interface RelationTimelineResponse {
  events: RelationTimelineEvent[];
}

// -----------------------------------------------------------------------
// 메모 타입 (GET /api/relations/[id]/memos)
// -----------------------------------------------------------------------

export interface MemoItem {
  memo_id: string;
  relation_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface MemoListResponse {
  items: MemoItem[];
}

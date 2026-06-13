import type { ShareRange } from '@/lib/share/schema';
import { formatTodayTemperature } from '@/lib/scoring/temperature';
import { formatShareModeLabel, truncateShareNickname } from '@/lib/share/display-format';

// H-4 (2026-06-13): 공유케미카드 5종 레이아웃 (정보 구성 변형). §1.1 확정.
export type ShareLayout = 'minimal' | 'ohaeng' | 'radar' | 'comment' | 'flow';

// 영역별 호환성 점수 (content.area_scores) — radar 레이아웃 입력
export interface ShareAreaScores {
  talk?: number;
  attract?: number;
  speed?: number;
  money?: number;
  future?: number;
}

export interface OgPayloadInput {
  nickname: string;
  score: number;
  mode: string;
  ohaeng_counts?: Record<string, number>;
  gender_normalized?: 'F' | 'M';
  area_scores?: ShareAreaScores;   // radar
  headline?: string;               // comment (한 줄)
  flow_scores?: number[];          // flow (스파크라인)
}

export interface OgPayloadOptions {
  layout: ShareLayout;
  showGender: boolean;             // ADR-024: 성별은 옵트인. 레이아웃과 직교.
}

export interface OgPayload {
  nickname: string;
  score: number;
  temperature_label: string;
  mode: string;
  layout: ShareLayout;
  showGender: boolean;
  ohaeng_counts?: Record<string, number>;
  gender_normalized?: 'F' | 'M';
  area_scores?: ShareAreaScores;
  headline?: string;
  flow_scores?: number[];
}

// 레이아웃이 노출 정보를 결정한다. 생일·시각·출생지는 어떤 레이아웃·옵션에서도 비노출 (ADR-024 핵심 불변).
export function buildOgPayload(input: OgPayloadInput, opts: OgPayloadOptions): OgPayload {
  const { layout, showGender } = opts;
  const base: OgPayload = {
    nickname: truncateShareNickname(input.nickname),
    score: input.score,
    temperature_label: formatTodayTemperature(input.score),
    mode: formatShareModeLabel(input.mode),
    layout,
    showGender,
  };

  if (layout === 'ohaeng') {
    base.ohaeng_counts = input.ohaeng_counts;
  } else if (layout === 'radar') {
    base.area_scores = input.area_scores;
  } else if (layout === 'comment') {
    base.headline = input.headline;
  } else if (layout === 'flow') {
    base.flow_scores = input.flow_scores;
  }

  if (showGender) {
    base.gender_normalized = input.gender_normalized;
  }

  return base;
}

// 레거시 range(별명만/+오행/+성별) → layout/showGender. 공개 토큰 OG 경로 하위호환용.
const RANGE_TO_LAYOUT: Record<ShareRange, OgPayloadOptions> = {
  'nickname-only': { layout: 'minimal', showGender: false },
  'nickname-ohaeng': { layout: 'ohaeng', showGender: false },
  'nickname-gender': { layout: 'minimal', showGender: true },
};

export function rangeToLayoutOptions(range: ShareRange): OgPayloadOptions {
  return RANGE_TO_LAYOUT[range];
}

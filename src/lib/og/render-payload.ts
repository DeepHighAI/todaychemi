import type { ShareRange } from '@/lib/share/schema';
import { weightsFor } from '@/lib/scoring/modeWeights';
import { formatTodayTemperature } from '@/lib/scoring/temperature';
import { formatShareModeLabel, truncateShareNickname } from '@/lib/share/display-format';
import type { ScoreBreakdown } from '@/types/hapcard';
import { ModeSchema } from '@/types/mode';

export const SHARE_OHAENG_ORDER = ['목', '화', '토', '금', '수'] as const;

// H-4 (2026-06-13): 공유케미카드 레이아웃.
// legacy 5종은 직접 URL/기존 테스트 하위호환용으로 유지하고, 앱 UI 기본 공유카드는 combined 하나만 사용한다.
export type ShareLayout = 'combined' | 'minimal' | 'ohaeng' | 'radar' | 'comment' | 'flow';

// radar 레이아웃 입력 — 나 vs 인연 오행(목화토금수) 오버레이 (인앱 미니 레이더 S-10-A 와 동일, §1.1)
export interface RadarOverlay {
  user: Record<string, number>;
  relation: Record<string, number>;
}

export interface ShareAreaScores {
  talk?: number;
  attract?: number;
  speed?: number;
  money?: number;
  future?: number;
}

const DEFAULT_COMPONENT_WEIGHTS = { hap: 1 / 3, sipsin: 1 / 3, ohaeng: 1 / 3 };

function clampScore(value: number, fallback = 50): number {
  const safe = Number.isFinite(value) ? value : fallback;
  return Math.min(100, Math.max(0, safe));
}

function roundScore(value: number): number {
  return Math.round(clampScore(value));
}

function normalizeOhaengCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

export function serializeShareOhaengCounts(counts?: Record<string, number>): string | null {
  if (!counts) return null;
  return SHARE_OHAENG_ORDER.map((key) => normalizeOhaengCount(counts[key])).join(',');
}

export function parseShareOhaengCountsParam(value: string | null): Record<string, number> | undefined {
  if (!value) return undefined;
  const parts = value.split(',').map((part) => Number(part));
  if (parts.length !== SHARE_OHAENG_ORDER.length || parts.some((part) => !Number.isFinite(part))) {
    return undefined;
  }
  return SHARE_OHAENG_ORDER.reduce<Record<string, number>>((acc, key, index) => {
    acc[key] = normalizeOhaengCount(parts[index]);
    return acc;
  }, {});
}

function resolveComponentWeights(mode: string): { hap: number; sipsin: number; ohaeng: number } {
  const parsed = ModeSchema.safeParse(mode);
  return parsed.success ? weightsFor(parsed.data) : DEFAULT_COMPONENT_WEIGHTS;
}

function readFinite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeBreakdownComponent(value: number, weight: number, weightedLike: boolean, fallback: number): number {
  const raw = readFinite(value, fallback);
  const normalized = weightedLike && weight > 0 ? raw / weight : raw;
  return clampScore(normalized, fallback);
}

export function deriveShareAreaScores(
  score: number,
  breakdown: ScoreBreakdown | null | undefined,
  mode: string,
): ShareAreaScores | undefined {
  if (!breakdown) return undefined;

  const base = clampScore(score);
  const weights = resolveComponentWeights(mode);
  const rawHap = readFinite(breakdown.hap_chung_hyung_hae, base);
  const rawSipsin = readFinite(breakdown.sipsin, base);
  const rawOhaeng = readFinite(breakdown.ohaeng, base);
  const yunseAdjustment = readFinite(breakdown.yunse_adjustment, 0);
  const modeAdjustment = readFinite(breakdown.mode_adjustment, 0);

  // Older rows/tests can hold weighted component contributions rather than normalized 0..100 axes.
  // Detect that shape and unweight it so the shared image does not render near-empty area bars.
  const weightedSum = rawHap + rawSipsin + rawOhaeng + yunseAdjustment + modeAdjustment;
  const looksWeighted =
    Math.max(rawHap, rawSipsin, rawOhaeng) <= 40 &&
    Math.abs(weightedSum - base) <= 20;

  const hap = normalizeBreakdownComponent(rawHap, weights.hap, looksWeighted, base);
  const sipsin = normalizeBreakdownComponent(rawSipsin, weights.sipsin, looksWeighted, base);
  const ohaeng = normalizeBreakdownComponent(rawOhaeng, weights.ohaeng, looksWeighted, base);
  const blendWithBase = (component: number) => roundScore(base * 0.45 + component * 0.55);
  const averageComponent = (hap + sipsin + ohaeng) / 3;

  return {
    talk: blendWithBase(sipsin),
    attract: blendWithBase(hap),
    speed: roundScore(base + yunseAdjustment * 2 + modeAdjustment * 0.5),
    money: blendWithBase(ohaeng),
    future: roundScore(base * 0.55 + averageComponent * 0.35 + yunseAdjustment * 1.5 + modeAdjustment * 0.4),
  };
}

export interface OgPayloadInput {
  nickname: string;
  score: number;
  mode: string;
  ohaeng_counts?: Record<string, number>;
  gender_normalized?: 'F' | 'M';
  radar?: RadarOverlay;            // radar (나 vs 인연 오행 오버레이)
  area_scores?: ShareAreaScores;    // combined (영역별 온도)
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
  radar?: RadarOverlay;
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

  if (layout === 'combined') {
    base.ohaeng_counts = input.ohaeng_counts;
    base.area_scores = input.area_scores;
    base.headline = input.headline;
  } else if (layout === 'ohaeng') {
    base.ohaeng_counts = input.ohaeng_counts;
  } else if (layout === 'radar') {
    base.radar = input.radar;
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

// layout/showGender → 레거시 range. 공개 토큰 OG(수신자 미리보기)는 아직 range 기반이므로,
// combined 는 DB 스키마 확장 전까지 가장 가까운 공개 범위로만 저장한다.
export function layoutToShareRange(layout: ShareLayout, showGender: boolean): ShareRange {
  if (layout === 'combined' && showGender) return 'nickname-gender';
  if (layout === 'combined') return 'nickname-ohaeng';
  if (layout === 'ohaeng') return 'nickname-ohaeng';
  if (showGender) return 'nickname-gender';
  return 'nickname-only';
}

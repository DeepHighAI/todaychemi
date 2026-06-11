// 관계 교차분석(cross) — 두 사람 ChartCore 사이의 십신·궁위·운세 교차 facts 산출.
// 100% 결정형: Date/Math.random/LLM 개입 0건. ADR-035 점수 무개입 — 점수 산출에 사용 금지,
// LLM 해석 근거 페이로드 전용 데이터 레이어 (ADR-040 예정).
// 한자 글자는 내부 데이터 레이어 허용 — UI 노출은 LLM 출력 + convertHanja 안전망 경유 (ADR-038).
// scoring 모듈은 순수 함수·상수 read-only import만 허용 (scoring 파일 0줄 수정).

import { HYUNG_TRIPLES, HYUNG_SELF, SAMHAP } from '@/lib/scoring/constants';
import { computeHapChungHyungHaeRaw } from '@/lib/scoring/hapChungHyungHae';
import type { ChartCore } from '@/types/chart';
import type { Mode } from '@/types/mode';

import { normalizeGanji, splitPillar, type Stem, type Branch } from './ganji';
import { JIJANGGAN } from './jijanggan';
import { sipsinOf, type SipsinName } from './sipsin';

// ---------------------------------------------------------------------------
// 버전 · 궁위 상수
// ---------------------------------------------------------------------------

export const CROSS_ANALYSIS_VERSION = 'cross-v1' as const;

export type PalaceLabel = '년주' | '월주' | '일주' | '시주';

// 궁위 의미 — LLM 해석 근거용 고정 라벨 (UI 직접 노출 아님)
export const PALACE_MEANINGS: Record<PalaceLabel, string> = {
  년주: '뿌리·초년',
  월주: '사회·부모',
  일주: '배우자궁·자아',
  시주: '미래·자식',
};

// ---------------------------------------------------------------------------
// 타입 (설계 §1.2)
// ---------------------------------------------------------------------------

export type SipsinGroup = '비겁' | '식상' | '재성' | '관성' | '인성';

export interface SipsinCrossDirection {
  // 상대 4천간 → 보는 쪽 일간 기준 십신 (결측 기둥 슬롯은 생략)
  stems: Partial<Record<'year' | 'month' | 'day' | 'hour', SipsinName>>;
  // 상대 4지지 정기(지장간 主氣)만 → 십신
  branches_jeonggi: Partial<Record<'year' | 'month' | 'day' | 'hour', SipsinName>>;
  // 8슬롯(결측 시 감소) 5그룹 집계 — 5키 전부 존재(0 포함)
  distribution: Record<SipsinGroup, number>;
  // 결정형 템플릿 문장 최대 3 — 선정 규칙은 buildSalient 주석 참조
  salient: string[];
}

export interface SipsinCross {
  self_to_relation: SipsinCrossDirection;
  relation_to_self: SipsinCrossDirection;
}

export interface GungwiEvent {
  kind:
    | 'stem_hap'
    | 'branch_hap'
    | 'chung'
    | 'pa'
    | 'hae'
    | 'hyung'
    | 'samhap_full'
    | 'samhap_half';
  // hyung(삼형·자형)/samhap 계열은 raw 이벤트에 pillarIndex 없음 → null
  palace: PalaceLabel | null;
  // ⚠ 키명 'palace_name' 금지 — PII 재귀 스캔 /(^|_)name($|_)/ 적중 (설계 §1.2)
  palace_meaning: string | null;
  detail: string;
}

export interface YunseCrossFact {
  layer: 'daeun' | 'seyun' | 'wolun' | 'iliun';
  // 세운/월운/일운은 공유 간지 → 'shared'
  direction: 'self_to_relation' | 'relation_to_self' | 'mutual' | 'shared';
  // yunse_spec §8.5 단순화 정합 — 형·파·해 제외
  kind: 'stem_hap' | 'branch_hap' | 'chung';
  detail: string;
}

export interface IlganPair {
  self_stem: string;
  relation_stem: string;
  self_polarity: '양' | '음';
  relation_polarity: '양' | '음';
  stem_hap: boolean;
  // 썸합/오래합 한정 — 재성/관성 방향성 facts
  mode_focus?: string[];
}

export interface AgeGapInfo {
  band: '동갑' | '1-3' | '4-6' | '7+';
  relation_is: '연상' | '연하' | '동갑';
}

export interface CrossAnalysis {
  version: typeof CROSS_ANALYSIS_VERSION;
  sipsin_cross: SipsinCross;
  // 정렬: 년→시→궁위 미상(null), 동일 궁위 내 kind 사전순, detail 사전순 — 결정성
  gungwi_events: GungwiEvent[];
  // 고정 순서: 대운(self→relation→mutual) → 세운 → 월운 → 일운 (이벤트 발생분만)
  yunse_cross: YunseCrossFact[];
  ilgan_pair: IlganPair;
  // hapcard만; replay/today 생략
  age_gap?: AgeGapInfo;
}

export interface ComputeCrossInput {
  self: ChartCore;
  relation: ChartCore;
  mode?: Mode;
  // 서버 내부 전용 — band 문자열만 출력물 진입, 연도 원본 비출력
  self_birth_year?: number;
  relation_birth_year?: number;
}

// today 전용 압축
export interface TodayCrossSummary {
  version: typeof CROSS_ANALYSIS_VERSION;
  ilgan_pair: IlganPair;
  // 일주 궁위 이벤트 detail만
  day_palace_links: string[];
  // 오늘 일진 ↔ 양측 일간·일지 합/충 facts
  iliun_links: string[];
}

// ---------------------------------------------------------------------------
// 내부 공통 — 기둥 정규화 분해
// ---------------------------------------------------------------------------

type PillarSlot = 'year' | 'month' | 'day' | 'hour';

const PILLAR_SLOTS: readonly PillarSlot[] = ['year', 'month', 'day', 'hour'];

interface PillarParts {
  stem: Stem;
  branch: Branch;
}

interface NormalizedPillars {
  year: PillarParts;
  month: PillarParts | null;
  day: PillarParts;
  hour: PillarParts | null;
}

// ChartCore 4기둥 정규화 분해 — 한글 독음 입력(테스트)도 한자(프로덕션)와 동일 결과 (인코딩 면역)
function normalizeChartPillars(chart: ChartCore): NormalizedPillars {
  return {
    year: splitPillar(normalizeGanji(chart.year_pillar)),
    month: chart.month_pillar !== null ? splitPillar(normalizeGanji(chart.month_pillar)) : null,
    day: splitPillar(normalizeGanji(chart.day_pillar)),
    hour: chart.hour_pillar !== null ? splitPillar(normalizeGanji(chart.hour_pillar)) : null,
  };
}

// ---------------------------------------------------------------------------
// 십신 교차 매트릭스
// ---------------------------------------------------------------------------

// 십신 → 5그룹 매핑 (비겁=비견+겁재 / 식상=식신+상관 / 재성=편재+정재 / 관성=편관+정관 / 인성=편인+정인)
const SIPSIN_TO_GROUP: Record<SipsinName, SipsinGroup> = {
  비견: '비겁',
  겁재: '비겁',
  식신: '식상',
  상관: '식상',
  편재: '재성',
  정재: '재성',
  편관: '관성',
  정관: '관성',
  편인: '인성',
  정인: '인성',
};

// distribution 최다 그룹 동률 판정용 고정 순서 — 결정성
const GROUP_ORDER: readonly SipsinGroup[] = ['비겁', '식상', '재성', '관성', '인성'];

const SALIENT_MAX = 3;
// ② 최다 그룹 문장 발화 최소 카운트
const DOMINANT_GROUP_MIN = 3;
// ③ 재성+관성 집중 문장 발화 최소 합계
const JAE_GWAN_FOCUS_MIN = 4;

interface SalientArgs {
  viewerLabel: '내' | '상대';
  targetLabel: '내' | '상대';
  targetDayStem: Stem;
  dayStemSipsin: SipsinName;
  distribution: Record<SipsinGroup, number>;
}

// salient 선정 규칙 (잠금 — 변경 시 cross.test.ts 동반 수정):
//   ① 타깃 일간 슬롯 십신 — 항상 1문장 (양측 day_pillar는 필수 필드라 항상 존재)
//   ② 최다 그룹 — max count >= DOMINANT_GROUP_MIN 일 때만. 동률은 GROUP_ORDER 첫 그룹.
//   ③ 재성+관성 합계 >= JAE_GWAN_FOCUS_MIN 이면 현실축(재·관) 집중 문장.
// 우선순위 ①→②→③ 순 생성, 최대 SALIENT_MAX개 (현 규칙상 3 초과 불가 — slice는 안전망).
function buildSalient(args: SalientArgs): string[] {
  const { viewerLabel, targetLabel, targetDayStem, dayStemSipsin, distribution } = args;
  const sentences: string[] = [];

  // ① 일간 슬롯 — 조사(은/는) 회피를 위해 '=' 표기 (결정형 보간만)
  const dayGroup = SIPSIN_TO_GROUP[dayStemSipsin];
  sentences.push(
    `${targetLabel} 일간(${targetDayStem}) = ${viewerLabel} 일간 기준 ${dayStemSipsin}(${dayGroup})`,
  );

  // ② 최다 그룹
  let maxGroup: SipsinGroup = GROUP_ORDER[0];
  for (const group of GROUP_ORDER) {
    if (distribution[group] > distribution[maxGroup]) maxGroup = group;
  }
  if (distribution[maxGroup] >= DOMINANT_GROUP_MIN) {
    sentences.push(
      `${viewerLabel} 일간 기준 ${targetLabel} 사주에 ${maxGroup} 기운이 ${distribution[maxGroup]}곳`,
    );
  }

  // ③ 재성·관성 집중 (현실축)
  const jaeGwanTotal = distribution['재성'] + distribution['관성'];
  if (jaeGwanTotal >= JAE_GWAN_FOCUS_MIN) {
    sentences.push(
      `${viewerLabel} 일간 기준 ${targetLabel} 사주에 재성·관성이 합 ${jaeGwanTotal}곳으로 집중`,
    );
  }

  return sentences.slice(0, SALIENT_MAX);
}

// 단방향 빌드 — viewer 일간 기준으로 target 4천간 + 4지지(정기) 판별
function buildSipsinDirection(
  viewerDayStem: Stem,
  target: NormalizedPillars,
  viewerLabel: '내' | '상대',
  targetLabel: '내' | '상대',
): SipsinCrossDirection {
  const stems: Partial<Record<PillarSlot, SipsinName>> = {};
  const branchesJeonggi: Partial<Record<PillarSlot, SipsinName>> = {};
  const distribution: Record<SipsinGroup, number> = {
    비겁: 0,
    식상: 0,
    재성: 0,
    관성: 0,
    인성: 0,
  };

  // 기둥 순서 고정(년→시) — 키 삽입 순서 결정성. 결측(월주/시주 null) 슬롯 자동 스킵.
  for (const slot of PILLAR_SLOTS) {
    const parts = target[slot];
    if (parts === null) continue;
    // 상대 일간(day stem)도 일반 타깃 — cross에는 '일간' 고정 슬롯 없음 (설계 §1.3)
    const stemSipsin = sipsinOf(viewerDayStem, parts.stem);
    // 지지분 = 지장간 정기만
    const branchSipsin = sipsinOf(viewerDayStem, JIJANGGAN[parts.branch].정기);
    stems[slot] = stemSipsin;
    branchesJeonggi[slot] = branchSipsin;
    distribution[SIPSIN_TO_GROUP[stemSipsin]] += 1;
    distribution[SIPSIN_TO_GROUP[branchSipsin]] += 1;
  }

  return {
    stems,
    branches_jeonggi: branchesJeonggi,
    distribution,
    salient: buildSalient({
      viewerLabel,
      targetLabel,
      targetDayStem: target.day.stem,
      dayStemSipsin: sipsinOf(viewerDayStem, target.day.stem),
      distribution,
    }),
  };
}

// 양방향 십신 교차 매트릭스 — 상대 글자 전체를 각자 일간 기준으로 판별
export function computeSipsinCross(self: ChartCore, relation: ChartCore): SipsinCross {
  const selfPillars = normalizeChartPillars(self);
  const relationPillars = normalizeChartPillars(relation);
  return {
    self_to_relation: buildSipsinDirection(selfPillars.day.stem, relationPillars, '내', '상대'),
    relation_to_self: buildSipsinDirection(relationPillars.day.stem, selfPillars, '상대', '내'),
  };
}

// ---------------------------------------------------------------------------
// 궁위(宮位) 이벤트 — scoring raw 재호출 (pure·cheap, scoring 0줄 수정)
// ---------------------------------------------------------------------------

// raw HapChungEvent.type → GungwiEvent.kind 는 1:1 동일 union (8종).
// pillarIndex 보유: stem_hap/branch_hap/chung/pa/hae.
// 미보유(소스 확인): hyung(삼형·자형 모두)/samhap_full/samhap_half → palace null.

const PALACE_BY_INDEX: readonly PalaceLabel[] = ['년주', '월주', '일주', '시주'];
// detail 문장용 궁위 1글자 — '년간'/'년지' 조립
const PALACE_SHORT: readonly string[] = ['년', '월', '일', '시'];
// 궁위 미상(null)은 정렬 시 맨 뒤
const PALACE_RANK_NULL = PALACE_BY_INDEX.length;

type IndexedKind = 'stem_hap' | 'branch_hap' | 'chung' | 'pa' | 'hae';

const KIND_SUFFIX: Record<IndexedKind, string> = {
  stem_hap: '천간합',
  branch_hap: '지지합',
  chung: '충',
  pa: '파',
  hae: '해',
};

function pillarAt(pillars: NormalizedPillars, index: number): PillarParts | null {
  const slot = PILLAR_SLOTS[index];
  return slot !== undefined ? pillars[slot] : null;
}

// raw 계산용 정규화 사본 — 기둥 4필드만 교체 (점수는 미사용, 이벤트 배열만 소비)
function withNormalizedPillars(chart: ChartCore, pillars: NormalizedPillars): ChartCore {
  return {
    ...chart,
    year_pillar: pillars.year.stem + pillars.year.branch,
    month_pillar: pillars.month !== null ? pillars.month.stem + pillars.month.branch : null,
    day_pillar: pillars.day.stem + pillars.day.branch,
    hour_pillar: pillars.hour !== null ? pillars.hour.stem + pillars.hour.branch : null,
  };
}

// 결측 기둥 제외 지지 목록 (년→시 순)
function presentBranches(pillars: NormalizedPillars): string[] {
  const branches: string[] = [];
  for (const slot of PILLAR_SLOTS) {
    const parts = pillars[slot];
    if (parts !== null) branches.push(parts.branch);
  }
  return branches;
}

// pillarIndex 보유 이벤트의 detail — '내 일지 午 ↔ 상대 일지 子 충' 형
function indexedDetail(
  kind: IndexedKind,
  selfPillars: NormalizedPillars,
  relationPillars: NormalizedPillars,
  index: number,
): string | null {
  const selfParts = pillarAt(selfPillars, index);
  const relationParts = pillarAt(relationPillars, index);
  if (selfParts === null || relationParts === null) return null;
  const short = PALACE_SHORT[index];
  if (kind === 'stem_hap') {
    return `내 ${short}간 ${selfParts.stem} ↔ 상대 ${short}간 ${relationParts.stem} ${KIND_SUFFIX.stem_hap}`;
  }
  return `내 ${short}지 ${selfParts.branch} ↔ 상대 ${short}지 ${relationParts.branch} ${KIND_SUFFIX[kind]}`;
}

// 형(삼형·자형) detail 재구성 큐 — raw 이벤트에 참여 지지 정보가 없어 동일 알고리즘·
// 동일 순회 순서로 재계산한다 (hapChungHyungHae.ts push 순서와 1:1 정렬:
// HYUNG_TRIPLES 순 → 자형 pair idx 순). 순서 가정이 깨지면 큐 고갈 시 일반 문구 폴백 —
// 결정성은 어느 쪽이든 유지.
function buildHyungDetailQueue(
  selfPillars: NormalizedPillars,
  relationPillars: NormalizedPillars,
): string[] {
  const combined = [...presentBranches(selfPillars), ...presentBranches(relationPillars)];
  const queue: string[] = [];
  for (const triple of HYUNG_TRIPLES) {
    if (triple.every((b) => combined.includes(b))) {
      queue.push(`양측 지지에 ${triple.join('·')} 삼형 구성`);
    }
  }
  // 자형 — 같은 궁위 지지 동일 + 자형 집합 (raw와 동일 pair 순회)
  for (let i = 0; i < PILLAR_SLOTS.length; i++) {
    const selfParts = pillarAt(selfPillars, i);
    const relationParts = pillarAt(relationPillars, i);
    if (selfParts === null || relationParts === null) continue;
    if (selfParts.branch === relationParts.branch && HYUNG_SELF.has(selfParts.branch)) {
      queue.push(
        `내 ${PALACE_SHORT[i]}지 ${selfParts.branch} ↔ 상대 ${PALACE_SHORT[i]}지 ${relationParts.branch} 자형`,
      );
    }
  }
  return queue;
}

// 삼합·반합 detail 재구성 큐 — SAMHAP 그룹 순회 순서가 raw push 순서와 1:1
function buildSamhapDetailQueues(
  selfPillars: NormalizedPillars,
  relationPillars: NormalizedPillars,
): { full: string[]; half: string[] } {
  const selfBranches = presentBranches(selfPillars);
  const relationBranches = presentBranches(relationPillars);
  const combined = [...selfBranches, ...relationBranches];
  const full: string[] = [];
  const half: string[] = [];
  for (const group of SAMHAP) {
    const present = group.full.filter((b) => combined.includes(b));
    if (present.length === 3) {
      full.push(`양측 지지에 ${group.full.join('·')} 삼합 완성`);
    } else if (present.length === 2) {
      const inSelf = group.full.filter((b) => selfBranches.includes(b)).length;
      const inRelation = group.full.filter((b) => relationBranches.includes(b)).length;
      if (inSelf >= 1 && inRelation >= 1) {
        half.push(`양측 지지에 ${present.join('·')} 반합`);
      }
    }
  }
  return { full, half };
}

function palaceRank(palace: PalaceLabel | null): number {
  return palace === null ? PALACE_RANK_NULL : PALACE_BY_INDEX.indexOf(palace);
}

// 두 사주 사이 합·충·형·파·해·삼합 이벤트를 궁위에 귀속
export function computeGungwiEvents(self: ChartCore, relation: ChartCore): GungwiEvent[] {
  const selfPillars = normalizeChartPillars(self);
  const relationPillars = normalizeChartPillars(relation);

  // raw 호출도 정규화 기둥으로 — 한글 입력 인코딩 면역
  const rawEvents = computeHapChungHyungHaeRaw(
    withNormalizedPillars(self, selfPillars),
    withNormalizedPillars(relation, relationPillars),
  );

  const hyungQueue = buildHyungDetailQueue(selfPillars, relationPillars);
  const samhapQueues = buildSamhapDetailQueues(selfPillars, relationPillars);

  const events: GungwiEvent[] = [];
  for (const raw of rawEvents) {
    // pillarIndex 미보유 종류 — palace null + 재구성 detail (큐 고갈 시 일반 문구 폴백)
    if (raw.type === 'hyung' || raw.type === 'samhap_full' || raw.type === 'samhap_half') {
      const detail =
        raw.type === 'hyung'
          ? (hyungQueue.shift() ?? '양측 지지 조합에서 형 발생')
          : raw.type === 'samhap_full'
            ? (samhapQueues.full.shift() ?? '양측 지지가 삼합 완성')
            : (samhapQueues.half.shift() ?? '양측 지지가 반합 구성');
      events.push({ kind: raw.type, palace: null, palace_meaning: null, detail });
      continue;
    }

    // pillarIndex 보유 종류 — 소스상 항상 설정되나 방어적으로 미설정 시 궁위 미상 처리
    const index = raw.pillarIndex;
    const palace = index !== undefined ? (PALACE_BY_INDEX[index] ?? null) : null;
    const detail = index !== undefined ? indexedDetail(raw.type, selfPillars, relationPillars, index) : null;
    events.push({
      kind: raw.type,
      palace,
      palace_meaning: palace !== null ? PALACE_MEANINGS[palace] : null,
      detail: detail ?? `${KIND_SUFFIX[raw.type]} 발생(궁위 미상)`,
    });
  }

  // 정렬: 년→시→궁위 미상, 동일 궁위 내 kind 사전순, 마지막 detail 사전순 — 결정성
  events.sort((a, b) => {
    const rank = palaceRank(a.palace) - palaceRank(b.palace);
    if (rank !== 0) return rank;
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
    return a.detail < b.detail ? -1 : a.detail > b.detail ? 1 : 0;
  });
  return events;
}

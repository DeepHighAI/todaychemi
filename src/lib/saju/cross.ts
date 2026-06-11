// 관계 교차분석(cross) — 두 사람 ChartCore 사이의 십신·궁위·운세 교차 facts 산출.
// 100% 결정형: Date/Math.random/LLM 개입 0건. ADR-035 점수 무개입 — 점수 산출에 사용 금지,
// LLM 해석 근거 페이로드 전용 데이터 레이어 (ADR-040 예정).
// 한자 글자는 내부 데이터 레이어 허용 — UI 노출은 LLM 출력 + convertHanja 안전망 경유 (ADR-038).
// scoring 모듈은 순수 함수·상수 read-only import만 허용 (scoring 파일 0줄 수정).

import { STEM_HAP, BRANCH_HAP, CHUNG } from '@/lib/scoring/constants';
import { computeHapChungHyungHaeRaw } from '@/lib/scoring/hapChungHyungHae';
import type { ChartCore } from '@/types/chart';
import type { Mode } from '@/types/mode';

import {
  STEMS,
  BRANCHES,
  STEM_INFO,
  normalizeGanji,
  splitPillar,
  type Stem,
  type Branch,
} from './ganji';
import { JIJANGGAN } from './jijanggan';
import {
  sipsinOf,
  SIPSIN_GROUP_ORDER,
  SIPSIN_TO_GROUP as SIPSIN_TO_GROUP_CANONICAL,
  type SipsinGroup,
  type SipsinName,
} from './sipsin';

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

// 5그룹 정의·순서는 saju/sipsin.ts 단일 출처 — 여기서는 재export만 (정의 드리프트 차단)
export type { SipsinGroup } from './sipsin';

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

// 십신 → 5그룹 매핑·고정 순서 — saju/sipsin.ts 단일 출처 (W2 통합)
const SIPSIN_TO_GROUP = SIPSIN_TO_GROUP_CANONICAL;
const GROUP_ORDER = SIPSIN_GROUP_ORDER;

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

  const events: GungwiEvent[] = [];
  for (const raw of rawEvents) {
    // 형·삼합 계열 — raw 이벤트의 participants(참여 지지) 메타데이터로 detail 직접 구성.
    // (이전의 push-order 1:1 재구성 큐는 제거 — 순서 가정 결합 해소, 리뷰 W3)
    if (raw.type === 'hyung' || raw.type === 'samhap_full' || raw.type === 'samhap_half') {
      // 자형(participants 1개)은 동일 슬롯 쌍이라 pillarIndex 로 궁위 귀속 가능
      const index = raw.pillarIndex;
      if (raw.type === 'hyung' && index !== undefined && raw.participants?.length === 1) {
        const palace = PALACE_BY_INDEX[index] ?? null;
        const branch = raw.participants[0];
        events.push({
          kind: raw.type,
          palace,
          palace_meaning: palace !== null ? PALACE_MEANINGS[palace] : null,
          detail: `내 ${PALACE_SHORT[index]}지 ${branch} ↔ 상대 ${PALACE_SHORT[index]}지 ${branch} 자형`,
        });
        continue;
      }
      const detail =
        raw.type === 'hyung'
          ? raw.participants !== undefined && raw.participants.length >= 3
            ? `양측 지지에 ${raw.participants.join('·')} 삼형 구성`
            : '양측 지지 조합에서 형 발생'
          : raw.type === 'samhap_full'
            ? raw.participants !== undefined
              ? `양측 지지에 ${raw.participants.join('·')} 삼합 완성`
              : '양측 지지가 삼합 완성'
            : raw.participants !== undefined
              ? `양측 지지에 ${raw.participants.join('·')} 반합`
              : '양측 지지가 반합 구성';
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

// ---------------------------------------------------------------------------
// 운세 교차 — 양측 yunse, kind는 stem_hap/branch_hap/chung만 (yunse_spec §8.5 정합)
// ---------------------------------------------------------------------------

const LAYER_LABELS: Record<YunseCrossFact['layer'], string> = {
  daeun: '현재 대운',
  seyun: '올해 세운',
  wolun: '이번 달 월운',
  iliun: '오늘 일진',
};

// scoring/hapChungHyungHae.ts의 stemKey/branchKey와 동일 규칙 (미export — 로컬 재유도).
// STEMS/BRANCHES 배열 순서 = kasi HEAVENLY_STEMS/EARTHLY_BRANCHES와 동일.
function stemPairKey(a: Stem, b: Stem): string {
  return STEMS.indexOf(a) <= STEMS.indexOf(b) ? a + b : b + a;
}

function branchPairKey(a: Branch, b: Branch): string {
  return BRANCHES.indexOf(a) <= BRANCHES.indexOf(b) ? a + b : b + a;
}

// 운세 간지 안전 분해 — normalizeGanji 선적용(한글/한자 양 인코딩 동일 결과), 무효 입력은 null
function safeYunseParts(pillar: string): PillarParts | null {
  const normalized = normalizeGanji(pillar);
  if (normalized.length !== 2) return null;
  try {
    return splitPillar(normalized);
  } catch {
    // 무효 간지(미지원 글자 등)는 해당 레이어 facts 스킵 — throw 전파 금지
    return null;
  }
}

// 두 간지 사이 합/충 판정 — 발생 kind 목록 (고정 순서 stem_hap → branch_hap → chung)
function pairKinds(a: PillarParts, b: PillarParts): Array<YunseCrossFact['kind']> {
  const kinds: Array<YunseCrossFact['kind']> = [];
  if (STEM_HAP[stemPairKey(a.stem, b.stem)] !== undefined) kinds.push('stem_hap');
  const branchKey = branchPairKey(a.branch, b.branch);
  if (BRANCH_HAP[branchKey] !== undefined) kinds.push('branch_hap');
  if (CHUNG[branchKey] !== undefined) kinds.push('chung');
  return kinds;
}

// 운세 기둥 ↔ 일주 비교 detail — '내 현재 대운(乙亥) 천간이 상대 일간(庚)과 천간합' 형
function yunseDetail(
  kind: YunseCrossFact['kind'],
  subject: string,
  yunseParts: PillarParts,
  counterLabel: '내' | '상대',
  day: PillarParts,
): string {
  const pillarStr = yunseParts.stem + yunseParts.branch;
  if (kind === 'stem_hap') {
    return `${subject}(${pillarStr}) 천간이 ${counterLabel} 일간(${day.stem})과 천간합`;
  }
  if (kind === 'branch_hap') {
    return `${subject}(${pillarStr}) 지지가 ${counterLabel} 일지(${day.branch})와 지지합`;
  }
  return `${subject}(${pillarStr}) 지지가 ${counterLabel} 일지(${day.branch})와 충`;
}

function mutualDaeunDetail(
  kind: YunseCrossFact['kind'],
  selfDaeun: PillarParts,
  relationDaeun: PillarParts,
): string {
  const selfStr = selfDaeun.stem + selfDaeun.branch;
  const relationStr = relationDaeun.stem + relationDaeun.branch;
  const suffix = kind === 'stem_hap' ? '천간합' : kind === 'branch_hap' ? '지지합' : '충';
  return `내 현재 대운(${selfStr}) ↔ 상대 현재 대운(${relationStr}) ${suffix}`;
}

// 현재 대운 기둥 — current_index 범위 밖/무효 간지는 null (해당 측 facts 스킵)
function currentDaeunParts(chart: ChartCore): PillarParts | null {
  const { list, current_index: currentIndex } = chart.yunse.daeun;
  if (currentIndex < 0 || currentIndex >= list.length) return null;
  return safeYunseParts(list[currentIndex].pillar);
}

// 양방향 운세 교차 facts.
//   대운 3방향: ①내 대운↔상대 일주 ②상대 대운↔내 일주 ③대운↔대운(mutual)
//   공유 레이어(세운·월운·일운): 같은 KST 날짜 기준 공유 간지 — self 측 yunse를 정본으로
//   사용해 양측 일주와 각각 비교 (direction 'shared'). 이벤트 발생분만 기록.
// 고정 순서: daeun(①→②→③) → seyun(내→상대) → wolun(내→상대) → iliun(내→상대),
// 각 비교 내부는 stem_hap → branch_hap → chung — 결정성.
export function computeYunseCross(self: ChartCore, relation: ChartCore): YunseCrossFact[] {
  const selfPillars = normalizeChartPillars(self);
  const relationPillars = normalizeChartPillars(relation);
  const facts: YunseCrossFact[] = [];

  const selfDaeun = currentDaeunParts(self);
  const relationDaeun = currentDaeunParts(relation);

  // ① 내 현재 대운 ↔ 상대 일주
  if (selfDaeun !== null) {
    for (const kind of pairKinds(selfDaeun, relationPillars.day)) {
      facts.push({
        layer: 'daeun',
        direction: 'self_to_relation',
        kind,
        detail: yunseDetail(kind, `내 ${LAYER_LABELS.daeun}`, selfDaeun, '상대', relationPillars.day),
      });
    }
  }

  // ② 상대 현재 대운 ↔ 내 일주
  if (relationDaeun !== null) {
    for (const kind of pairKinds(relationDaeun, selfPillars.day)) {
      facts.push({
        layer: 'daeun',
        direction: 'relation_to_self',
        kind,
        detail: yunseDetail(kind, `상대 ${LAYER_LABELS.daeun}`, relationDaeun, '내', selfPillars.day),
      });
    }
  }

  // ③ 대운 ↔ 대운
  if (selfDaeun !== null && relationDaeun !== null) {
    for (const kind of pairKinds(selfDaeun, relationDaeun)) {
      facts.push({
        layer: 'daeun',
        direction: 'mutual',
        kind,
        detail: mutualDaeunDetail(kind, selfDaeun, relationDaeun),
      });
    }
  }

  // ④ 공유 레이어 — 세운/월운/일운 ↔ 양측 일주
  const sharedLayers: ReadonlyArray<{ layer: YunseCrossFact['layer']; pillar: string }> = [
    { layer: 'seyun', pillar: self.yunse.seyun.current_pillar },
    { layer: 'wolun', pillar: self.yunse.wolun.current_pillar },
    { layer: 'iliun', pillar: self.yunse.iliun.today_pillar },
  ];
  const daySides: ReadonlyArray<{ day: PillarParts; label: '내' | '상대' }> = [
    { day: selfPillars.day, label: '내' },
    { day: relationPillars.day, label: '상대' },
  ];
  for (const { layer, pillar } of sharedLayers) {
    const parts = safeYunseParts(pillar);
    if (parts === null) continue;
    for (const { day, label } of daySides) {
      for (const kind of pairKinds(parts, day)) {
        facts.push({
          layer,
          direction: 'shared',
          kind,
          detail: yunseDetail(kind, LAYER_LABELS[layer], parts, label, day),
        });
      }
    }
  }

  return facts;
}

// ---------------------------------------------------------------------------
// 일간 페어 + 연령차 밴드 + 통합 엔트리
// ---------------------------------------------------------------------------

// mode_focus 발화 대상 모드 (설계 §1.3 — 썸합/오래합 한정)
const MODE_FOCUS_MODES: ReadonlySet<Mode> = new Set<Mode>(['썸합', '오래합']);
// mode_focus 기록 대상 십신 그룹 — 현실축(재성·관성)만
const FOCUS_GROUPS: ReadonlySet<SipsinGroup> = new Set<SipsinGroup>(['재성', '관성']);

// 연령차 밴드 경계 — |diff| 0=동갑 / 1..NEAR_MAX / NEAR_MAX+1..MID_MAX / 그 이상 7+
const AGE_BAND_NEAR_MAX = 3;
const AGE_BAND_MID_MAX = 6;

function buildIlganPair(
  selfPillars: NormalizedPillars,
  relationPillars: NormalizedPillars,
  mode: Mode | undefined,
): IlganPair {
  const selfStem = selfPillars.day.stem;
  const relationStem = relationPillars.day.stem;
  const pair: IlganPair = {
    self_stem: selfStem,
    relation_stem: relationStem,
    self_polarity: STEM_INFO[selfStem].yinyang,
    relation_polarity: STEM_INFO[relationStem].yinyang,
    stem_hap: STEM_HAP[stemPairKey(selfStem, relationStem)] !== undefined,
  };

  // mode_focus — 썸합/오래합 한정. 양방향 일간 십신 중 재성/관성 그룹만 facts로 기록
  // (해당 없으면 빈 배열 — 키는 존재). 그 외 모드·모드 미지정 시 키 자체 부재.
  if (mode !== undefined && MODE_FOCUS_MODES.has(mode)) {
    const facts: string[] = [];
    const selfView = sipsinOf(selfStem, relationStem);
    if (FOCUS_GROUPS.has(SIPSIN_TO_GROUP[selfView])) {
      facts.push(`내 일간 기준 상대 일간 = ${selfView}(${SIPSIN_TO_GROUP[selfView]})`);
    }
    const relationView = sipsinOf(relationStem, selfStem);
    if (FOCUS_GROUPS.has(SIPSIN_TO_GROUP[relationView])) {
      facts.push(`상대 일간 기준 내 일간 = ${relationView}(${SIPSIN_TO_GROUP[relationView]})`);
    }
    pair.mode_focus = facts;
  }
  return pair;
}

// 연령차 밴드 — 연도 원본은 서버 내부 전용 입력, band/relation_is 문자열만 출력물 진입.
// 음력 연초 ±1 오차는 문서화된 단순화 (설계 §1.3).
function buildAgeGap(
  selfBirthYear: number | undefined,
  relationBirthYear: number | undefined,
): AgeGapInfo | undefined {
  if (selfBirthYear === undefined || relationBirthYear === undefined) return undefined;
  // 양수 = 상대가 늦게 출생(연하)
  const diff = relationBirthYear - selfBirthYear;
  const gap = Math.abs(diff);
  const band: AgeGapInfo['band'] =
    gap === 0 ? '동갑' : gap <= AGE_BAND_NEAR_MAX ? '1-3' : gap <= AGE_BAND_MID_MAX ? '4-6' : '7+';
  const relationIs: AgeGapInfo['relation_is'] = diff === 0 ? '동갑' : diff < 0 ? '연상' : '연하';
  return { band, relation_is: relationIs };
}

// 교차분석 통합 엔트리 — 100% 결정형. 점수 산출 무개입(ADR-035), LLM 해석 근거 전용.
export function computeCrossAnalysis(input: ComputeCrossInput): CrossAnalysis {
  const selfPillars = normalizeChartPillars(input.self);
  const relationPillars = normalizeChartPillars(input.relation);

  const analysis: CrossAnalysis = {
    version: CROSS_ANALYSIS_VERSION,
    sipsin_cross: computeSipsinCross(input.self, input.relation),
    gungwi_events: computeGungwiEvents(input.self, input.relation),
    yunse_cross: computeYunseCross(input.self, input.relation),
    ilgan_pair: buildIlganPair(selfPillars, relationPillars, input.mode),
  };

  // age_gap — 양측 연도 모두 제공 시에만 (hapcard 전용; replay/today 생략)
  const ageGap = buildAgeGap(input.self_birth_year, input.relation_birth_year);
  if (ageGap !== undefined) analysis.age_gap = ageGap;
  return analysis;
}

// fail-open 래퍼 — 레거시 jsonb 변형 기둥(빈 문자열·공백·비간지 문자)은 splitPillar 가
// throw 한다. 교차분석은 LLM 해석 근거 전용이므로 실패 시 생략(undefined) + warn 으로
// 강등하고 유료 요청 자체는 차단하지 않는다 (resolveDerivedForLlm 과 동일 정책, 리뷰 F3).
export function computeCrossAnalysisSafe(input: ComputeCrossInput): CrossAnalysis | undefined {
  try {
    return computeCrossAnalysis(input);
  } catch (err) {
    console.warn('[CROSS_INVALID]', {
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

// today 전용 압축 — 일주 궁위 이벤트 + 오늘 일진 facts만 (토큰 절약)
export function projectCrossForToday(cross: CrossAnalysis): TodayCrossSummary {
  // 명시 복사 — 원본 객체/배열 참조 공유 방지
  const ilganPair: IlganPair = {
    self_stem: cross.ilgan_pair.self_stem,
    relation_stem: cross.ilgan_pair.relation_stem,
    self_polarity: cross.ilgan_pair.self_polarity,
    relation_polarity: cross.ilgan_pair.relation_polarity,
    stem_hap: cross.ilgan_pair.stem_hap,
  };
  if (cross.ilgan_pair.mode_focus !== undefined) {
    ilganPair.mode_focus = [...cross.ilgan_pair.mode_focus];
  }
  return {
    version: cross.version,
    ilgan_pair: ilganPair,
    day_palace_links: cross.gungwi_events
      .filter((event) => event.palace === '일주')
      .map((event) => event.detail),
    iliun_links: cross.yunse_cross
      .filter((fact) => fact.layer === 'iliun')
      .map((fact) => fact.detail),
  };
}

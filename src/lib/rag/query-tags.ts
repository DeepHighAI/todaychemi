import { resolveDerivedForLlm } from '@/lib/llm/payload';
import type { CrossAnalysis, GungwiEvent, YunseCrossFact } from '@/lib/saju/cross';
import type { ChartCore } from '@/types/chart';
import type { Mode } from '@/types/relation';

// ISSUE-001 (2026-06-12 §1.1 결정 ③): 단문 임베딩 쿼리가 임계 0.60을 못 넘어
// classic_citation 이 전면 0건이던 문제 — topic_tags lexical 직매칭용 쿼리 태그.
// 태그 어휘는 rag_content/classics/*.yaml topic_tags 단일 출처와 동기 유지.

export interface RagTagInput {
  mode: Mode;
  self: ChartCore;
}

// 신강약 verdict → 고전 태그 (manseryeok_theory §6.7 — 억부 중심)
const SINKANG_TAGS: Record<'신강' | '신약' | '중화', readonly string[]> = {
  신강: ['daymaster_strength', 'suppress_or_support'],
  신약: ['daymaster_strength', 'weak_daymaster_balance', 'suppress_or_support'],
  중화: ['moderation_ideal', 'balance_harmony', 'strength_balance'],
};

// dominant 십신 5그룹 → 고전 태그
const DOMINANT_SIPSIN_TAGS: Record<string, readonly string[]> = {
  비겁: ['peer_support', 'peer_rivalry', 'same_root_competition'],
  식상: ['expression_channel', 'food_god_usage', 'food_god_strong'],
  재성: ['wealth_activation', 'creative_wealth', 'partial_wealth_generous'],
  관성: ['proper_officer_steady', 'seven_killings_control', 'authority_achieved'],
  인성: ['guardian_energy', 'seal_overload'],
};

// 파생층(지장간 기반 집계) 존재 시 항상 — 三命通會 장둔가/사령일수 계열
const DERIVED_BASE_TAGS = ['hidden_stems', 'branch_inner_composition'] as const;

const YONGSIN_TAG = 'useful_god';

// 궁위 이벤트 존재 시 — 궁위/사주 역할 고전
const GUNGWI_BASE_TAGS = ['palace_positions', 'four_pillars_roles'] as const;

// 배우자궁(일주) 이벤트는 연애 계열 모드에서만 spouse_palace 부여
const SPOUSE_PALACE_MODES: readonly Mode[] = ['썸합', '오래합'];
const SPOUSE_PALACE_TAG = 'spouse_palace';

// 합·충 이벤트 kind → 고전 태그 (pa/hae/hyung 은 대응 고전 자산 없어 미부여)
const EVENT_KIND_TAGS: Partial<
  Record<GungwiEvent['kind'] | YunseCrossFact['kind'], readonly string[]>
> = {
  samhap_full: ['triple_harmony', 'combined_strength', 'synergy_energy'],
  samhap_half: ['triple_harmony', 'combined_strength', 'synergy_energy'],
  stem_hap: ['attraction_energy', 'combined_strength'],
  branch_hap: ['attraction_energy', 'combined_strength'],
  chung: ['six_clash', 'separation_tendency', 'unresolved_conflict'],
};

// mode + 파생층 + 교차분석 → topic_tags lexical 매칭용 쿼리 태그 (결정형, 중복 제거)
export function buildRagQueryTags(input: RagTagInput, cross: CrossAnalysis | null): string[] {
  const tags: string[] = [input.mode];

  const derived = resolveDerivedForLlm(input.self);
  if (derived) {
    tags.push(...DERIVED_BASE_TAGS);
    tags.push(...SINKANG_TAGS[derived.sinkang.verdict]);
    for (const group of derived.dominant_sipsin) {
      const groupTags = DOMINANT_SIPSIN_TAGS[group];
      if (groupTags) tags.push(...groupTags);
    }
    if (derived.yongsin_candidates.length > 0) tags.push(YONGSIN_TAG);
  }

  if (cross) {
    if (cross.gungwi_events.length > 0) {
      tags.push(...GUNGWI_BASE_TAGS);
    }
    for (const event of cross.gungwi_events) {
      if (event.palace === '일주' && SPOUSE_PALACE_MODES.includes(input.mode)) {
        tags.push(SPOUSE_PALACE_TAG);
      }
      const kindTags = EVENT_KIND_TAGS[event.kind];
      if (kindTags) tags.push(...kindTags);
    }
    for (const fact of cross.yunse_cross) {
      const kindTags = EVENT_KIND_TAGS[fact.kind];
      if (kindTags) tags.push(...kindTags);
    }
  }

  return [...new Set(tags)];
}

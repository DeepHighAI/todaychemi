import { resolveDerivedForLlm } from '@/lib/llm/payload';
import type { DiagnosticType } from '@/types/diagnostic';
import type { ChartCore } from '@/types/chart';

const TYPE_TAGS: Record<DiagnosticType, readonly string[]> = {
  work: ['authority_achieved', 'expression_channel'],
  love: ['attraction_energy', 'spouse_palace'],
  conflict: ['unresolved_conflict', 'six_clash'],
  leadership: ['proper_officer_steady', 'authority_achieved'],
  money: ['wealth_activation', 'creative_wealth'],
  first_meet: ['attraction_energy', 'four_pillars_roles'],
};

const SINKANG_TAGS: Record<'신강' | '신약' | '중화', readonly string[]> = {
  신강: ['daymaster_strength', 'suppress_or_support'],
  신약: ['daymaster_strength', 'weak_daymaster_balance', 'suppress_or_support'],
  중화: ['moderation_ideal', 'balance_harmony', 'strength_balance'],
};

const DOMINANT_SIPSIN_TAGS: Record<string, readonly string[]> = {
  비겁: ['peer_support', 'peer_rivalry', 'same_root_competition'],
  식상: ['expression_channel', 'food_god_usage', 'food_god_strong'],
  재성: ['wealth_activation', 'creative_wealth', 'partial_wealth_generous'],
  관성: ['proper_officer_steady', 'seven_killings_control', 'authority_achieved'],
  인성: ['guardian_energy', 'seal_overload'],
};

export interface WhatifRagTagInput {
  type: DiagnosticType;
  chart: ChartCore;
}

export function buildWhatifRagQueryTags(input: WhatifRagTagInput): string[] {
  const tags: string[] = [...TYPE_TAGS[input.type]];
  const derived = resolveDerivedForLlm(input.chart);
  if (derived) {
    tags.push('hidden_stems', 'branch_inner_composition');
    tags.push(...SINKANG_TAGS[derived.sinkang.verdict]);
    for (const group of derived.dominant_sipsin) {
      const groupTags = DOMINANT_SIPSIN_TAGS[group];
      if (groupTags) tags.push(...groupTags);
    }
    if (derived.yongsin_candidates.length > 0) tags.push('useful_god');
  }

  return [...new Set(tags)];
}

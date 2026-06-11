import type { BuildHapcardInput } from '@/lib/hapcard/builder';
import { projectDerivedForLlm } from '@/lib/llm/payload';

// 오늘 케미 RAG 검색용 쿼리 텍스트.
// PII §5: chart_core + mode 만 사용. user_id/relation_id/hash 누출 금지.
export function buildRagQueryText(input: BuildHapcardInput): string {
  const { mode, self, relation } = input;
  const tokens = [
    mode,
    `일주 ${self.day_pillar}`,
    `일간 ${self.day_master_element}`,
    `상대 일주 ${relation.day_pillar}`,
    `상대 일간 ${relation.day_master_element}`,
  ];
  // P3-8 (ADR-040): derived 존재 시 grounding 어휘 보강 — 신강약 verdict + dominant 십신 그룹.
  // v2 레거시(derived 부재)는 기존 텍스트 그대로 (회귀 0). 결정형 projection 재사용.
  if (self.derived) {
    const llmDerived = projectDerivedForLlm(self.derived);
    tokens.push(llmDerived.sinkang.verdict);
    if (llmDerived.dominant_sipsin.length > 0) {
      tokens.push(`십신 ${llmDerived.dominant_sipsin.join(' ')}`);
    }
  }
  return tokens.join(' ');
}

import type { BuildHapcardInput } from '@/lib/hapcard/builder';

// 합카드 RAG 검색용 쿼리 텍스트.
// PII §5: chart_core + mode 만 사용. user_id/relation_id/hash 누출 금지.
export function buildRagQueryText(input: BuildHapcardInput): string {
  const { mode, self, relation } = input;
  return [
    mode,
    `일주 ${self.day_pillar}`,
    `일간 ${self.day_master_element}`,
    `상대 일주 ${relation.day_pillar}`,
    `상대 일간 ${relation.day_master_element}`,
  ].join(' ');
}

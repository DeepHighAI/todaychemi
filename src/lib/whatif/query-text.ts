import type { BuildWhatifInput } from '@/lib/whatif/builder';

// 마이플레이 RAG 검색용 쿼리 텍스트.
// PII §5: chart_core + type 만 사용. user_id/chart_hash 누출 금지.
export function buildWhatifRagQueryText(input: BuildWhatifInput): string {
  const { type, chart } = input;
  return [`${type}`, `일주 ${chart.day_pillar}`, `일간 ${chart.day_master_element}`].join(' ');
}

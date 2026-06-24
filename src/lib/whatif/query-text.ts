import type { BuildWhatifInput } from '@/lib/whatif/builder';
import { resolveDerivedForLlm } from '@/lib/llm/payload';

// 오늘의 나는? RAG 검색용 쿼리 텍스트.
// PII §5: chart_core + type 만 사용. user_id/chart_hash 누출 금지.
export function buildWhatifRagQueryText(input: BuildWhatifInput): string {
  const { type, chart } = input;
  const derived = resolveDerivedForLlm(chart);
  return [
    `${type}`,
    `target_date ${input.target_date}`,
    `일주 ${chart.day_pillar}`,
    `일간 ${chart.day_master_element}`,
    `일운 ${chart.yunse.iliun.today_pillar}`,
    `월운 ${chart.yunse.wolun.current_pillar}`,
    `세운 ${chart.yunse.seyun.current_pillar}`,
    ...(derived
      ? [
          `신강약 ${derived.sinkang.verdict}`,
          `우세 십신 ${derived.dominant_sipsin.join(' ')}`,
          `부족 십신 ${derived.missing_sipsin.join(' ')}`,
          `용신 후보 ${derived.yongsin_candidates.join(' ')}`,
        ]
      : []),
  ].join(' ');
}

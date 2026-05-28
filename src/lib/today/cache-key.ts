import { createHash } from 'node:crypto';
import type { ChartCore } from '@/types/chart';

export interface SourcePacketInput {
  self_chart: ChartCore;
  relation_chart: ChartCore | null;
  target_date: string;
  prompt_version: string;
  model_id: string;
}

// G2 / Phase 3 — 캐시 키 차원 확장: relation_chart, prompt_version, model_id 추가
// relation_chart 가 null 이면 사용자 단독 today 캐시(인연 미보유 사용자).
export function buildSourcePacketHash(input: SourcePacketInput): string {
  const packet = JSON.stringify({
    self_chart: input.self_chart,
    relation_chart: input.relation_chart,
    target_date: input.target_date,
    prompt_version: input.prompt_version,
    model_id: input.model_id,
  });
  return createHash('sha256').update(packet).digest('hex');
}

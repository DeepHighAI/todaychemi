import { createHash } from 'node:crypto';
import type { DiagnosticType } from '@/types/diagnostic';

export interface WhatifCacheKeyInput {
  chart_hash: string;
  type: DiagnosticType;
  prompt_version: string;
}

// llm_governance.md §1.3 — sha256(chart + type + prompt). whatif는 self-anchor (relation 없음, theory profile 비의존).
export function deriveCacheKey(input: WhatifCacheKeyInput): string {
  const payload = input.chart_hash + input.type + input.prompt_version;
  return createHash('sha256').update(payload).digest('hex');
}

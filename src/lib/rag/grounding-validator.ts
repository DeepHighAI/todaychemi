import type { HapcardLlmOutput } from '@/lib/llm/output-schema';
import type { ClassicHit } from '@/lib/rag/classics';

export type GroundingErrorReason = 'RAG_CLASSIC_MISS' | 'CLASSIC_TEXT_MISMATCH';

export interface GroundingError {
  reason: GroundingErrorReason;
  asset_id: string;
  index: number;
  detail?: { originalMatch: boolean; translationMatch: boolean };
}

export type GroundingResult =
  | { valid: true; skipped?: boolean }
  | { valid: false; errors: GroundingError[] };

// llm_grounding.md §6 — 전수 검증 후 aggregate (D3)
// original_text / modern_translation은 정규화 없이 === 비교 (ADR-018)
export function validateClassicCitations(
  llmOutput: Pick<HapcardLlmOutput, 'classic_citation'>,
  ragHits: ClassicHit[],
): GroundingResult {
  if (llmOutput.classic_citation.length === 0) {
    return { valid: true, skipped: true };
  }

  const errors: GroundingError[] = [];

  for (let i = 0; i < llmOutput.classic_citation.length; i++) {
    const citation = llmOutput.classic_citation[i];
    const hit = ragHits.find((h) => h.asset_id === citation.asset_id);

    if (!hit) {
      errors.push({ reason: 'RAG_CLASSIC_MISS', asset_id: citation.asset_id, index: i });
      continue;
    }

    const originalMatch = citation.original_text === hit.original_text;
    const translationMatch = citation.modern_translation === hit.modern_translation;

    if (!originalMatch || !translationMatch) {
      errors.push({
        reason: 'CLASSIC_TEXT_MISMATCH',
        asset_id: citation.asset_id,
        index: i,
        detail: { originalMatch, translationMatch },
      });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

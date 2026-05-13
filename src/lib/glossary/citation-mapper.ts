import { stripHanjaInParens, translateChapter, convertHanja } from '@/lib/glossary/post-process';

export type LlmCitationShape = {
  source_title?: unknown;
  source_chapter?: unknown;
  original_text?: unknown;
  modern_translation?: unknown;
};

export function mapLlmCitation(
  citation: LlmCitationShape,
  ragHit?: { original_reading?: string | null },
) {
  return {
    source: `${stripHanjaInParens((citation.source_title as string) ?? '')} ${translateChapter((citation.source_chapter as string) ?? '')}`.trim(),
    original: ragHit?.original_reading ?? convertHanja((citation.original_text as string) ?? ''),
    modern: (citation.modern_translation as string) ?? '',
  };
}

import { describe, it, expect } from 'vitest';
import { validateClassicCitations } from '@/lib/rag/grounding-validator';
import type { ClassicHit } from '@/lib/rag/classics';

function makeHit(id: string, originalText: string, modernTranslation: string): ClassicHit {
  return {
    asset_id: id,
    source_title: '연해자평',
    source_chapter: '권1',
    original_text: originalText,
    original_reading: null,
    modern_translation: modernTranslation,
    topic_tags: ['합'],
    similarity: 0.85,
    tier: 'required',
  };
}

function makeCitation(assetId: string, originalText: string, modernTranslation: string) {
  return {
    asset_id: assetId,
    source_title: '연해자평',
    source_chapter: '권1',
    original_text: originalText,
    modern_translation: modernTranslation,
    relevance_explanation: '관련성 설명',
  };
}

describe('validateClassicCitations — 원문 인용 전수 검증', () => {
  it('classic_citation 빈 배열 → skipped: true', () => {
    const result = validateClassicCitations({ classic_citation: [] }, []);
    expect(result).toEqual({ valid: true, skipped: true });
  });

  it('단일 citation, asset_id RAG에 존재, original_text + modern_translation 일치 → valid: true', () => {
    const hit = makeHit('classic_001', '官多者身弱', '관성이 많아 신약하다');
    const citation = makeCitation('classic_001', '官多者身弱', '관성이 많아 신약하다');
    const result = validateClassicCitations({ classic_citation: [citation] }, [hit]);
    expect(result).toEqual({ valid: true });
  });

  it('asset_id RAG에 없음 → errors[0].reason=RAG_CLASSIC_MISS, index=0', () => {
    const citation = makeCitation('nonexistent_001', '원문', '번역');
    const result = validateClassicCitations({ classic_citation: [citation] }, []);
    expect(result).toEqual({
      valid: false,
      errors: [{ reason: 'RAG_CLASSIC_MISS', asset_id: 'nonexistent_001', index: 0 }],
    });
  });

  it('original_text 불일치 → CLASSIC_TEXT_MISMATCH, detail.originalMatch=false, detail.translationMatch=true', () => {
    const hit = makeHit('classic_001', '官多者身弱', '관성이 많아 신약하다');
    const citation = makeCitation('classic_001', '官多者身弱 변형', '관성이 많아 신약하다');
    const result = validateClassicCitations({ classic_citation: [citation] }, [hit]);
    expect(result).toEqual({
      valid: false,
      errors: [
        {
          reason: 'CLASSIC_TEXT_MISMATCH',
          asset_id: 'classic_001',
          index: 0,
          detail: { originalMatch: false, translationMatch: true },
        },
      ],
    });
  });

  it('modern_translation 불일치 → CLASSIC_TEXT_MISMATCH, detail.originalMatch=true, detail.translationMatch=false', () => {
    const hit = makeHit('classic_001', '官多者身弱', '관성이 많아 신약하다');
    const citation = makeCitation('classic_001', '官多者身弱', '다른 번역문');
    const result = validateClassicCitations({ classic_citation: [citation] }, [hit]);
    expect(result).toEqual({
      valid: false,
      errors: [
        {
          reason: 'CLASSIC_TEXT_MISMATCH',
          asset_id: 'classic_001',
          index: 0,
          detail: { originalMatch: true, translationMatch: false },
        },
      ],
    });
  });

  it('original_text + modern_translation 둘 다 불일치 → detail 양쪽 false', () => {
    const hit = makeHit('classic_001', '官多者身弱', '관성이 많아 신약하다');
    const citation = makeCitation('classic_001', '다른원문', '다른번역');
    const result = validateClassicCitations({ classic_citation: [citation] }, [hit]);
    if (result.valid) throw new Error('expected invalid');
    expect(result.errors[0].detail).toEqual({ originalMatch: false, translationMatch: false });
  });

  it('복수 citation, 첫째 valid + 둘째 invalid → errors.length=1, errors[0].index=1', () => {
    const hit1 = makeHit('classic_001', '原文A', '번역A');
    const hit2 = makeHit('classic_002', '原文B', '번역B');
    const citations = [
      makeCitation('classic_001', '原文A', '번역A'),
      makeCitation('classic_002', '原文B', '번역B 변형'),
    ];
    const result = validateClassicCitations({ classic_citation: citations }, [hit1, hit2]);
    expect(result).toEqual({
      valid: false,
      errors: [
        {
          reason: 'CLASSIC_TEXT_MISMATCH',
          asset_id: 'classic_002',
          index: 1,
          detail: { originalMatch: true, translationMatch: false },
        },
      ],
    });
  });

  it('복수 citation, 첫째 RAG_MISS + 둘째 TEXT_MISMATCH → errors.length=2, 순서 보존', () => {
    const hit2 = makeHit('classic_002', '原文B', '번역B');
    const citations = [
      makeCitation('missing_001', '原文A', '번역A'),
      makeCitation('classic_002', '原文B', '번역B 변형'),
    ];
    const result = validateClassicCitations({ classic_citation: citations }, [hit2]);
    if (result.valid) throw new Error('expected invalid');
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toMatchObject({ reason: 'RAG_CLASSIC_MISS', asset_id: 'missing_001', index: 0 });
    expect(result.errors[1]).toMatchObject({ reason: 'CLASSIC_TEXT_MISMATCH', asset_id: 'classic_002', index: 1 });
  });

  it('복수 citation 모두 valid → valid: true', () => {
    const hits = [
      makeHit('classic_001', '原文A', '번역A'),
      makeHit('classic_002', '原文B', '번역B'),
    ];
    const citations = [
      makeCitation('classic_001', '原文A', '번역A'),
      makeCitation('classic_002', '原文B', '번역B'),
    ];
    const result = validateClassicCitations({ classic_citation: citations }, hits);
    expect(result).toEqual({ valid: true });
  });

  it('정규화 금지 — 공백 차이는 mismatch ("官多者身弱" vs "官多者 身弱")', () => {
    const hit = makeHit('classic_001', '官多者身弱', '관성이 많아 신약하다');
    const citation = makeCitation('classic_001', '官多者 身弱', '관성이 많아 신약하다');
    const result = validateClassicCitations({ classic_citation: [citation] }, [hit]);
    expect(result).toMatchObject({ valid: false });
    if (result.valid) throw new Error('expected invalid');
    expect(result.errors[0].reason).toBe('CLASSIC_TEXT_MISMATCH');
    expect(result.errors[0].detail?.originalMatch).toBe(false);
  });
});

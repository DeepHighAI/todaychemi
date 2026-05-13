import { describe, expect, it } from 'vitest';
import { mapLlmCitation } from '@/lib/glossary/citation-mapper';

describe('mapLlmCitation', () => {
  it('maps citation with ragHit — uses original_reading over convertHanja', () => {
    const citation = {
      source_title: '적천수(滴天髓)',
      source_chapter: '第一章',
      original_text: '甲木参天',
      modern_translation: '갑목이 하늘로 뻗어오른다',
    };
    const ragHit = { original_reading: 'RAG 원문' };
    const result = mapLlmCitation(citation, ragHit);
    expect(result.original).toBe('RAG 원문');
    expect(result.modern).toBe('갑목이 하늘로 뻗어오른다');
    expect(typeof result.source).toBe('string');
    expect(result.source.length).toBeGreaterThan(0);
  });

  it('maps citation without ragHit — uses convertHanja fallback', () => {
    const citation = {
      source_title: '자평진전(子平眞詮)',
      source_chapter: '제2장',
      original_text: '乙木雖柔',
    };
    const result = mapLlmCitation(citation);
    expect(typeof result.original).toBe('string');
    expect(result.modern).toBe('');
  });

  it('handles undefined fields gracefully', () => {
    const result = mapLlmCitation({});
    expect(result.source).toBe('');
    expect(result.original).toBe('');
    expect(result.modern).toBe('');
  });
});

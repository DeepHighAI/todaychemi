import { describe, it, expect } from 'vitest';
import messages from '../../../messages/ko.json';

describe('i18n glossary 네임스페이스 (ko)', () => {
  const g = (messages as Record<string, unknown>).glossary as Record<string, unknown>;

  it('glossary 네임스페이스 존재', () => {
    expect(g).toBeDefined();
  });

  it('definition_label 키 존재', () => {
    expect(typeof g?.definition_label).toBe('string');
  });

  it('classic_label 키 존재', () => {
    expect(typeof g?.classic_label).toBe('string');
  });

  it('dismiss 키 존재', () => {
    expect(typeof g?.dismiss).toBe('string');
  });

  it('learn_more 키 존재', () => {
    expect(typeof g?.learn_more).toBe('string');
  });

  describe('sheet 하위 네임스페이스', () => {
    const sheet = (g?.sheet ?? null) as Record<string, unknown> | null;

    it('sheet 네임스페이스 존재', () => {
      expect(sheet).not.toBeNull();
    });

    it('sheet.title 키 존재', () => {
      expect(typeof sheet?.title).toBe('string');
    });

    it('sheet.learn_more_cta 키 존재', () => {
      expect(typeof sheet?.learn_more_cta).toBe('string');
    });

    it('sheet.related_terms_label 키 존재', () => {
      expect(typeof sheet?.related_terms_label).toBe('string');
    });
  });
});

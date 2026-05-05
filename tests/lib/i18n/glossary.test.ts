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
});

import { describe, it, expect } from 'vitest';
import { extractConclusion } from '@/lib/hapcard/extract-conclusion';

describe('extractConclusion', () => {
  it('마침표(.) 기준 첫 문장 추출', () => {
    expect(extractConclusion('두 사람의 인연은 깊다. 서로를 이해하며 성장한다.')).toBe('두 사람의 인연은 깊다.');
  });

  it('온점(。) 기준 첫 문장 추출', () => {
    expect(extractConclusion('강한 끌림이 존재한다。그러나 갈등도 따른다。')).toBe('강한 끌림이 존재한다。');
  });

  it('물음표(?) 기준 첫 문장 추출', () => {
    expect(extractConclusion('이 인연은 운명일까? 별자리도 맞아떨어진다.')).toBe('이 인연은 운명일까?');
  });

  it('구분자 없으면 전체 텍스트 반환 (fallback)', () => {
    const text = '짧은 텍스트';
    expect(extractConclusion(text)).toBe(text);
  });
});

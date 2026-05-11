import { describe, it, expect } from 'vitest';
import {
  BRANCH_READINGS,
  COMPOUND_READINGS,
  CHAPTER_READINGS,
  STEM_READINGS,
  ELEMENT_READINGS,
  RELATION_READINGS,
  SIPSIN_READINGS,
  SHINSAL_READINGS,
  SINGLE_CHAR_READINGS,
} from '@/lib/glossary/hanja-readings';

describe('BRANCH_READINGS', () => {
  it('12개 항목을 가진다', () => {
    expect(Object.keys(BRANCH_READINGS)).toHaveLength(12);
  });
  it('子 → 자', () => expect(BRANCH_READINGS['子']).toBe('자'));
  it('午 → 오', () => expect(BRANCH_READINGS['午']).toBe('오'));
  it('亥 → 해', () => expect(BRANCH_READINGS['亥']).toBe('해'));
});

describe('STEM_READINGS', () => {
  it('10개 항목을 가진다', () => {
    expect(Object.keys(STEM_READINGS)).toHaveLength(10);
  });
  it('甲 → 갑', () => expect(STEM_READINGS['甲']).toBe('갑'));
  it('癸 → 계', () => expect(STEM_READINGS['癸']).toBe('계'));
});

describe('ELEMENT_READINGS', () => {
  it('5개 항목을 가진다', () => {
    expect(Object.keys(ELEMENT_READINGS)).toHaveLength(5);
  });
  it('木 → 목', () => expect(ELEMENT_READINGS['木']).toBe('목'));
  it('水 → 수', () => expect(ELEMENT_READINGS['水']).toBe('수'));
});

describe('RELATION_READINGS', () => {
  it('合 → 합', () => expect(RELATION_READINGS['合']).toBe('합'));
  it('沖 → 충', () => expect(RELATION_READINGS['沖']).toBe('충'));
});

describe('SIPSIN_READINGS', () => {
  it('正印 → 정인', () => expect(SIPSIN_READINGS['正印']).toBe('정인'));
  it('七殺 → 칠살', () => expect(SIPSIN_READINGS['七殺']).toBe('칠살'));
  it('偏印 → 편인', () => expect(SIPSIN_READINGS['偏印']).toBe('편인'));
});

describe('SHINSAL_READINGS', () => {
  it('桃花殺 → 도화살', () => expect(SHINSAL_READINGS['桃花殺']).toBe('도화살'));
  it('桃花 → 도화', () => expect(SHINSAL_READINGS['桃花']).toBe('도화'));
  it('月德貴人 → 월덕귀인', () => expect(SHINSAL_READINGS['月德貴人']).toBe('월덕귀인'));
});

describe('COMPOUND_READINGS', () => {
  it('子午沖 → 자오충', () => expect(COMPOUND_READINGS['子午沖']).toBe('자오충'));
  it('寅午戌 → 인오술', () => expect(COMPOUND_READINGS['寅午戌']).toBe('인오술'));
  it('三合 → 삼합', () => expect(COMPOUND_READINGS['三合']).toBe('삼합'));
  it('水剋火 → 수극화', () => expect(COMPOUND_READINGS['水剋火']).toBe('수극화'));
  it('金生水 → 금생수', () => expect(COMPOUND_READINGS['金生水']).toBe('금생수'));
});

describe('CHAPTER_READINGS', () => {
  it('通神頌 → 통신송', () => expect(CHAPTER_READINGS['通神頌']).toBe('통신송'));
  it('體用 → 체용', () => expect(CHAPTER_READINGS['體用']).toBe('체용'));
  it('三命通會 → 삼명통회', () => expect(CHAPTER_READINGS['三命通會']).toBe('삼명통회'));
  it('滴天髓 → 적천수', () => expect(CHAPTER_READINGS['滴天髓']).toBe('적천수'));
});

describe('SINGLE_CHAR_READINGS', () => {
  it('천간·지지·오행·관계자 포함', () => {
    // 지지
    expect(SINGLE_CHAR_READINGS['子']).toBe('자');
    // 천간
    expect(SINGLE_CHAR_READINGS['甲']).toBe('갑');
    // 오행
    expect(SINGLE_CHAR_READINGS['木']).toBe('목');
    // 관계자
    expect(SINGLE_CHAR_READINGS['合']).toBe('합');
  });
});

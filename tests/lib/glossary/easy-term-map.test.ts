// G-5 (2026-06-13 D7 확정): 쉽게 보기 평이어 사전 — 결정형 치환

import { describe, expect, it } from 'vitest';
import { EASY_TERM_MAP, toEasyText } from '@/lib/glossary/easy-term-map';

describe('EASY_TERM_MAP — D7 확정 사전', () => {
  it('십신 10종 + 5그룹 + 파생 7종 = 22항목', () => {
    expect(Object.keys(EASY_TERM_MAP)).toHaveLength(22);
  });

  it('단글자 용어(합/형/충/해)는 포함하지 않는다 (오매칭 방지 — soft-term-map 경로 사용)', () => {
    expect(EASY_TERM_MAP['합']).toBeUndefined();
    expect(EASY_TERM_MAP['충']).toBeUndefined();
  });
});

describe('toEasyText — 평이어 치환', () => {
  it('십신 용어를 평이어로 치환한다', () => {
    expect(toEasyText('비견 교차로 동료감이 크다')).toBe('나와 같은 기운 교차로 동료감이 크다');
  });

  it('파생 용어를 평이어로 치환한다', () => {
    expect(toEasyText('신강으로 판단된 구성')).toBe('기운이 강한 사주로 판단된 구성');
  });

  it('한 문장의 복수 용어를 모두 치환한다', () => {
    expect(toEasyText('재성과 관성의 균형')).toBe('재물 기운과 책임 기운의 균형');
  });

  it('긴 용어 우선 — 지장간이 일간보다 먼저 매칭된다', () => {
    expect(toEasyText('지장간 분포')).toBe('지지 속에 숨은 기운 분포');
  });

  it('사전에 없는 텍스트는 원문 그대로', () => {
    const original = '오늘은 차분한 확인 메시지가 좋아요';
    expect(toEasyText(original)).toBe(original);
  });

  it('결정형 — 동일 입력 동일 출력', () => {
    const input = '편인 구조와 식신의 만남, 용신은 금';
    expect(toEasyText(input)).toBe(toEasyText(input));
  });

  // 치환어의 받침 유무에 맞춰 뒤따르는 조사를 조화시킨다
  it('조사 조화 — 이/가', () => {
    expect(toEasyText('일간이 토이고')).toBe('나를 나타내는 글자가 토이고');
  });

  it('조사 조화 — 을/를', () => {
    expect(toEasyText('용신을 살펴보세요')).toBe('균형을 잡아주는 기운을 살펴보세요');
  });

  it('조사 조화 — 은/는 (받침 유지 케이스)', () => {
    expect(toEasyText('식상은 강하다')).toBe('표현 기운은 강하다');
  });
});

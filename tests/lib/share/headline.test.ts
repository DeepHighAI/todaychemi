import { describe, it, expect } from 'vitest';
import { extractShareHeadline } from '@/lib/share/headline';

describe('extractShareHeadline', () => {
  it('"결론 =" 접두를 제거하고 첫 문장만', () => {
    expect(extractShareHeadline('결론 = 동료감이 큰 사이예요. 서로 배려가 깊어요.')).toBe(
      '동료감이 큰 사이예요',
    );
  });

  it('접두 없으면 첫 문장만', () => {
    expect(extractShareHeadline('잘 맞는 사이예요. 다만 속도 차이가 있어요.')).toBe('잘 맞는 사이예요');
  });

  it('여러 줄이면 첫 줄 우선', () => {
    expect(extractShareHeadline('끌림이 강해요\n둘째 줄')).toBe('끌림이 강해요');
  });

  it('40자 초과 시 절단 + 말줄임표', () => {
    const long = '가'.repeat(60);
    const r = extractShareHeadline(long);
    expect(r.length).toBeLessThanOrEqual(41);
    expect(r.endsWith('…')).toBe(true);
  });

  it('빈 문자열 → 빈 문자열', () => {
    expect(extractShareHeadline('')).toBe('');
    expect(extractShareHeadline('   ')).toBe('');
  });
});

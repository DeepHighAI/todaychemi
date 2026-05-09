import { describe, it, expect } from 'vitest';
import { ClassicCitationBaseSchema, HapcardClassicCitationSchema } from '@/lib/rag/citation-schema';

const BASE = {
  asset_id: 'a1',
  source_title: '주역',
  source_chapter: '건괘',
  original_text: '天行健',
  modern_translation: '하늘의 운행은 굳세다',
};

describe('ClassicCitationBaseSchema', () => {
  it('5필드 최소 파싱 성공', () => {
    expect(() => ClassicCitationBaseSchema.parse(BASE)).not.toThrow();
  });

  it('unknown 키 허용 (base 는 strict 미적용)', () => {
    const withExtra = { ...BASE, extra_field: 'x' };
    const result = ClassicCitationBaseSchema.parse(withExtra);
    expect(result).toMatchObject(BASE);
  });
});

describe('HapcardClassicCitationSchema', () => {
  const HAPCARD = { ...BASE, relevance_explanation: '건강 운세와 관련됨' };

  it('relevance_explanation 포함 시 파싱 성공', () => {
    expect(() => HapcardClassicCitationSchema.parse(HAPCARD)).not.toThrow();
  });

  it('optional 필드 없어도 성공', () => {
    expect(() => HapcardClassicCitationSchema.parse(HAPCARD)).not.toThrow();
  });

  it('relevance_explanation 없으면 실패', () => {
    expect(() => HapcardClassicCitationSchema.parse(BASE)).toThrow();
  });

  it('unknown 키 strict 거부', () => {
    expect(() =>
      HapcardClassicCitationSchema.parse({ ...HAPCARD, unknown_key: 'x' }),
    ).toThrow();
  });
});

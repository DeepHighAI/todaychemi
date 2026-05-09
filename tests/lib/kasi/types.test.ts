import { describe, it, expect } from 'vitest';
import { KasiLunCalResponseSchema } from '@/lib/kasi/types';
import sampleResponse from '../../fixtures/kasi_responses/lun_cal_info_sample.json';

describe('KasiLunCalResponseSchema', () => {
  it('parses a valid success response', () => {
    const result = KasiLunCalResponseSchema.safeParse(sampleResponse);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.response.body.items.item.lunSecha).toBe('庚午');
    expect(result.data.response.body.items.item.lunIljin).toBe('壬子');
  });

  it('rejects response with missing lunSecha', () => {
    const bad = structuredClone(sampleResponse);
     
    delete (bad as any).response.body.items.item.lunSecha;
    const result = KasiLunCalResponseSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects response with missing lunIljin', () => {
    const bad = structuredClone(sampleResponse);
     
    delete (bad as any).response.body.items.item.lunIljin;
    const result = KasiLunCalResponseSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects a non-00 resultCode', () => {
    const bad = structuredClone(sampleResponse);
     
    (bad as any).response.header.resultCode = '30';
    const result = KasiLunCalResponseSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('parses response where lunWolgeon is empty string (윤달 leap month — KASI returns "")', () => {
    const leapMonth = {
      response: {
        header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
        body: {
          items: {
            item: {
              lunSecha: '정묘(丁卯)',
              lunWolgeon: '',
              lunIljin: '무술(戊戌)',
              lunLeapmonth: '윤',
              lunMonth: '06',
              lunDay: 23,
              lunYear: 1987,
            },
          },
        },
      },
    };
    const result = KasiLunCalResponseSchema.safeParse(leapMonth);
    expect(result.success).toBe(true);
  });

  it('parses real KASI response where lunMonth/lunDay are zero-padded strings ("02", "05")', () => {
    // KASI는 단일 자릿수 음력월·일을 문자열 zero-pad로 반환 ("02", "05" 등)
    const realFormat = {
      response: {
        header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
        body: {
          items: {
            item: {
              lunSecha: '경오(庚午)',
              lunWolgeon: '경인(庚寅)',
              lunIljin: '기묘(己卯)',
              lunYear: 1990,
              lunMonth: '02',
              lunDay: '19',
              lunLeapmonth: '평',
              lunNday: 30,
            },
          },
        },
      },
    };
    const result = KasiLunCalResponseSchema.safeParse(realFormat);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.response.body.items.item.lunMonth).toBe(2);
    expect(result.data.response.body.items.item.lunDay).toBe(19);
  });
});

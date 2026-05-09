import { describe, it, expect } from 'vitest';
import { normalizeKasiToChartCore } from '@/lib/kasi/normalize';
import type { KasiLunCalItem } from '@/lib/kasi/types';

const baseItem: KasiLunCalItem = {
  lunSecha: '庚午',
  lunWolgeon: '庚子',
  lunIljin: '壬子',
  lunYear: 1990,
  lunMonth: 2,
  lunDay: 19,
  lunLeapmonth: 'false',
};

// 1990-04-15 양력 — ssaju 절기 기준 月柱 = 庚辰
const baseBirthInput = { year: 1990, month: 4, day: 15, hour: 0, minute: 0, calendar: 'solar' as const };

describe('normalizeKasiToChartCore', () => {
  it('computes year_pillar via ssaju (입춘 기준), NOT KASI lunSecha (합삭 기준)', () => {
    // baseBirthInput = 1990-04-15 (입춘 후) → ssaju 年柱 = 庚午, lunSecha와 우연히 동일
    const core = normalizeKasiToChartCore(baseItem, 'M', null, baseBirthInput);
    expect(core.year_pillar).toBe('庚午');
  });

  it('computes month_pillar via ssaju (절기 기준), maps lunIljin to day_pillar', () => {
    // lunWolgeon='庚子'는 무시됨 — ssaju 절기 기준 庚辰이 반환되어야 한다
    const core = normalizeKasiToChartCore(baseItem, 'F', null, baseBirthInput);
    expect(core.month_pillar).toBe('庚辰'); // ssaju 절기 기준 (1990-04-15)
    expect(core.day_pillar).toBe('壬子');   // KASI lunIljin 그대로
  });

  it('year_pillar+month_pillar follow solar term boundary, not lunar 月建/歲次', () => {
    // B001: 1990-02-04 05:15 — 입춘 直前
    // KASI lunSecha='경오(庚午)' (1990 합삭 후), lunWolgeon='무인(戊寅)'
    // ssaju 절기 기준: 입춘 未到 → 年柱=己巳(1989), 月柱=丁丑
    const boundaryItem: KasiLunCalItem = {
      lunSecha: '경오(庚午)',
      lunWolgeon: '무인(戊寅)',
      lunIljin: '갑자(甲子)',
      lunYear: 1990,
      lunMonth: 1,
      lunDay: 10,
      lunLeapmonth: 'false',
    };
    const b001Input = { year: 1990, month: 2, day: 4, hour: 5, minute: 15, calendar: 'solar' as const };
    const core = normalizeKasiToChartCore(boundaryItem, 'M', '05:15', b001Input);
    expect(core.year_pillar).toBe('己巳');  // ssaju (입춘 前) — NOT '庚午' (lunSecha)
    expect(core.month_pillar).toBe('丁丑'); // ssaju (입춘 前) — NOT '戊寅' (lunWolgeon)
  });

  it('returns null hour_pillar when timeStr is null', () => {
    const core = normalizeKasiToChartCore(baseItem, 'M', null, baseBirthInput);
    expect(core.hour_pillar).toBeNull();
  });

  it('computes hour_pillar from lunIljin stem and hour (14:30)', () => {
    // 壬日, hour=14 → 未支(index 7), base=6 → (6+7)%10=3 → 丁 → 丁未
    const core = normalizeKasiToChartCore(baseItem, 'M', '14:30', baseBirthInput);
    expect(core.hour_pillar).toBe('丁未');
  });

  it('hour 23 uses current day stem (야자시 어드밴스 제거 — 조자시 통합 학파)', () => {
    // 壬日 base=6, branch=子(0), stem=(6+0)%10=6 → 庚 → 庚子
    // ADR-037 §1.1 결정 (2026-05-03): ssaju와 동일 기준 채택
    const core = normalizeKasiToChartCore(baseItem, 'M', '23:30', baseBirthInput);
    expect(core.hour_pillar).toBe('庚子');
  });

  it('hour 00 uses current day stem (조자시 — 변화 없음)', () => {
    // 壬日 00시: base=6, branch=子(0) → 庚子
    const core = normalizeKasiToChartCore(baseItem, 'M', '00:30', baseBirthInput);
    expect(core.hour_pillar).toBe('庚子');
  });

  it('hour 22 uses current day stem (sanity check, 변화 없음)', () => {
    // 壬日 22시: base=6, branch=亥(11), stem=(6+11)%10=7 → 辛 → 辛亥
    const core = normalizeKasiToChartCore(baseItem, 'M', '22:30', baseBirthInput);
    expect(core.hour_pillar).toBe('辛亥');
  });

  it('sets day_master_element from lunIljin stem', () => {
    // 壬 → 수
    const core = normalizeKasiToChartCore(baseItem, 'M', null, baseBirthInput);
    expect(core.day_master_element).toBe('수');
  });

  it('counts five_elements_counts from year+month+day pillars when no hour', () => {
    // 庚午(금화) + 庚辰(금토) + 壬子(수수) = 목0 화1 토1 금2 수2
    const core = normalizeKasiToChartCore(baseItem, 'M', null, baseBirthInput);
    expect(core.five_elements_counts).toEqual({ 목: 0, 화: 1, 토: 1, 금: 2, 수: 2 });
  });

  it('counts five_elements_counts including hour pillar when time is given', () => {
    // 庚午(금화) + 庚辰(금토) + 壬子(수수) + 丁未(화토) = 목0 화2 토2 금2 수2
    const core = normalizeKasiToChartCore(baseItem, 'M', '14:30', baseBirthInput);
    expect(core.five_elements_counts).toEqual({ 목: 0, 화: 2, 토: 2, 금: 2, 수: 2 });
  });

  it('passes through gender_normalized', () => {
    expect(normalizeKasiToChartCore(baseItem, 'M', null, baseBirthInput).gender_normalized).toBe('M');
    expect(normalizeKasiToChartCore(baseItem, 'F', null, baseBirthInput).gender_normalized).toBe('F');
  });

  it('윤달(lunWolgeon="")에도 ssaju 기준 月柱 반환 — null 없음', () => {
    // 기존: lunWolgeon='' → null 반환. 신규: ssaju가 month 항상 반환
    const leapItem: KasiLunCalItem = { ...baseItem, lunWolgeon: '' };
    const core = normalizeKasiToChartCore(leapItem, 'M', null, baseBirthInput);
    expect(core.month_pillar).toBe('庚辰'); // ssaju 절기 기준 — NOT null
  });

  it('extracts hanja from Korean-reading+paren format (real KASI response)', () => {
    // 실제 KASI 응답: "경오(庚午)" "경자(庚子)" "임자(壬子)"
    // lunWolgeon='경자(庚子)' — 이 값은 무시되고 ssaju 기준 月柱가 반환됨
    const realFormatItem: KasiLunCalItem = {
      ...baseItem,
      lunSecha: '경오(庚午)',
      lunWolgeon: '경자(庚子)',
      lunIljin: '임자(壬子)',
    };
    const core = normalizeKasiToChartCore(realFormatItem, 'M', null, baseBirthInput);
    expect(core.year_pillar).toBe('庚午');
    expect(core.month_pillar).toBe('庚辰'); // ssaju — NOT '庚子' (lunWolgeon)
    expect(core.day_pillar).toBe('壬子');
    expect(core.day_master_element).toBe('수'); // 壬→수
    expect(core.five_elements_counts).toEqual({ 목: 0, 화: 1, 토: 1, 금: 2, 수: 2 });
  });
});

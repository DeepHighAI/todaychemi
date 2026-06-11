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

  it('computes hour_pillar from lunIljin stem and hour (14:30 → 진태양시 13:58 → 未)', () => {
    // 壬日, 14:30 보정(서울 −32.1 + EoT −0.2) → 837.7분(13:58) → 未支(7), base=6 → 丁未
    const core = normalizeKasiToChartCore(baseItem, 'M', '14:30', baseBirthInput);
    expect(core.hour_pillar).toBe('丁未');
  });

  it('23:30 → 진태양시 22:58 → 亥時 (ADR-021 보정 효과 — 학파 변경 아님)', () => {
    // 壬日, 1377.7분(22:58) → 亥(11), (6+11)%10=7 → 辛亥.
    // 보정 후 자시 진입은 ~23:32부터. 조자시 통합 학파(ADR-037)는 그대로 유지된다.
    const core = normalizeKasiToChartCore(baseItem, 'M', '23:30', baseBirthInput);
    expect(core.hour_pillar).toBe('辛亥');
  });

  it('00:30 → 보정으로 전날 23:58이어도 子時 + 당일 일간 (시주-only 보정)', () => {
    // 壬日, −2.3분 → 정규화 1437.7(23:57) → 子(0), 일간은 입력 날짜 당일 유지 → 庚子
    const core = normalizeKasiToChartCore(baseItem, 'M', '00:30', baseBirthInput);
    expect(core.hour_pillar).toBe('庚子');
  });

  it('hour 22 uses current day stem (sanity check, 변화 없음)', () => {
    // 壬日 22:30 → 1317.7분(21:58) → 亥(11), stem=(6+11)%10=7 → 辛 → 辛亥
    const core = normalizeKasiToChartCore(baseItem, 'M', '22:30', baseBirthInput);
    expect(core.hour_pillar).toBe('辛亥');
  });

  describe('진태양시 시지 경계 (ADR-021 Amended — 서울 기본 −32.1분 + 균시차)', () => {
    it('17:05 → 진태양시 16:33 → 申時 (壬日 戊申)', () => {
      // 992.7분 → 申(8), (6+8)%10=4 → 戊申. 보정 미적용이면 酉時(辛酉)였을 케이스.
      const core = normalizeKasiToChartCore(baseItem, 'M', '17:05', baseBirthInput);
      expect(core.hour_pillar).toBe('戊申');
    });

    it('사용자 보고 케이스 동형: 戊申日 17:05 → 庚申 (3eyes 일치)', () => {
      // 戊日 base=8, 申(8) → (8+8)%10=6 → 庚申. 보정 전 구현은 辛酉를 반환했다.
      const userCaseItem: KasiLunCalItem = { ...baseItem, lunIljin: '무신(戊申)' };
      const core = normalizeKasiToChartCore(userCaseItem, 'M', '17:05', baseBirthInput);
      expect(core.hour_pillar).toBe('庚申');
    });

    it('17:40 → 진태양시 17:08 → 酉時 유지 (壬日 己酉)', () => {
      // 1027.7분 → 酉(9), (6+9)%10=5 → 己酉
      const core = normalizeKasiToChartCore(baseItem, 'M', '17:40', baseBirthInput);
      expect(core.hour_pillar).toBe('己酉');
    });

    it('15:30 → 진태양시 14:58 → 未時 (경계 직전)', () => {
      const core = normalizeKasiToChartCore(baseItem, 'M', '15:30', baseBirthInput);
      expect(core.hour_pillar).toBe('丁未');
    });

    it('15:35 → 진태양시 15:03 → 申時 진입', () => {
      const core = normalizeKasiToChartCore(baseItem, 'M', '15:35', baseBirthInput);
      expect(core.hour_pillar).toBe('戊申');
    });

    it('경도 명시(135°E 표준자오선) → 경도항 0, EoT만 적용', () => {
      // 17:05 + EoT(−0.2) = 1024.8분(17:04) → 酉(9) → 己酉 (서울 기본과 다른 결과)
      const core = normalizeKasiToChartCore(baseItem, 'M', '17:05', baseBirthInput, {
        birth_longitude: 135,
      });
      expect(core.hour_pillar).toBe('己酉');
    });

    it('solar_date 명시 시 균시차는 그 날짜 기준 (음력 입력 보호 경로)', () => {
      // 11월 초 EoT ≈ +16.4분: 17:20 − 32.1 + 16.4 ≈ 1024.3분(17:04) → 酉
      // (4월 기준이면 1007.7분(16:47) → 申이 됐을 입력 — solar_date가 실제로 반영됨을 판별)
      const core = normalizeKasiToChartCore(baseItem, 'M', '17:20', baseBirthInput, {
        solar_date: { year: 1990, month: 11, day: 3 },
      });
      expect(core.hour_pillar).toBe('己酉');
    });
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

  describe('파생층 derived 부착 (theory v3 — "v3 ⇒ derived 존재" 불변식)', () => {
    it('chart_core.derived가 존재하고 derived_version=2·hour_known 반영', () => {
      const core = normalizeKasiToChartCore(baseItem, 'M', '14:30', baseBirthInput);
      expect(core.derived).toBeDefined();
      expect(core.derived?.derived_version).toBe(2);
      expect(core.derived?.hour_known).toBe(true);
      expect(core.derived?.ilju.pillar).toBe('壬子');
    });

    it('derived.sinkang.level은 3값 중 하나, 시간 미상 시 hour_known=false', () => {
      const core = normalizeKasiToChartCore(baseItem, 'M', null, baseBirthInput);
      expect(['신강', '중화', '신약']).toContain(core.derived?.sinkang.level);
      expect(core.derived?.hour_known).toBe(false);
      expect(core.derived?.sipsin.hour).toBeNull();
    });
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

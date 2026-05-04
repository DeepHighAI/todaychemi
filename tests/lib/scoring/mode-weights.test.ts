import { describe, it, expect } from 'vitest';
import { weightsFor } from '@/lib/scoring/modeWeights';
import type { Mode } from '@/types/mode';

const ALL_MODES: Mode[] = ['일합', '친구합', '돈합', '첫합', '썸합', '오래합'];

describe('weightsFor (§6 6모드 가중치)', () => {
  it('모든 모드에 대해 가중치 합 = 1.0', () => {
    for (const mode of ALL_MODES) {
      const w = weightsFor(mode);
      const sum = w.hap + w.sipsin + w.ohaeng;
      expect(sum).toBeCloseTo(1.0, 10);
    }
  });

  it('모든 개별 가중치는 0 초과 1 미만', () => {
    for (const mode of ALL_MODES) {
      const w = weightsFor(mode);
      for (const v of [w.hap, w.sipsin, w.ohaeng]) {
        expect(v).toBeGreaterThan(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('일합: hap=0.35, sipsin=0.40, ohaeng=0.25', () => {
    expect(weightsFor('일합')).toEqual({ hap: 0.35, sipsin: 0.40, ohaeng: 0.25 });
  });

  it('친구합: hap=0.45, sipsin=0.25, ohaeng=0.30', () => {
    expect(weightsFor('친구합')).toEqual({ hap: 0.45, sipsin: 0.25, ohaeng: 0.30 });
  });

  it('돈합: hap=0.35, sipsin=0.35, ohaeng=0.30', () => {
    expect(weightsFor('돈합')).toEqual({ hap: 0.35, sipsin: 0.35, ohaeng: 0.30 });
  });

  it('첫합: hap=0.50, sipsin=0.20, ohaeng=0.30', () => {
    expect(weightsFor('첫합')).toEqual({ hap: 0.50, sipsin: 0.20, ohaeng: 0.30 });
  });

  it('썸합: hap=0.45, sipsin=0.25, ohaeng=0.30', () => {
    expect(weightsFor('썸합')).toEqual({ hap: 0.45, sipsin: 0.25, ohaeng: 0.30 });
  });

  it('오래합: hap=0.40, sipsin=0.25, ohaeng=0.35', () => {
    expect(weightsFor('오래합')).toEqual({ hap: 0.40, sipsin: 0.25, ohaeng: 0.35 });
  });

  it('§6 기본 가중치 합 = 0.40+0.30+0.30 = 1.0 (기준)', () => {
    // 전체 6모드 평균이 기본 가중치(0.40/0.30/0.30)에 근접
    const avgHap = ALL_MODES.reduce((s, m) => s + weightsFor(m).hap, 0) / ALL_MODES.length;
    const avgSipsin = ALL_MODES.reduce((s, m) => s + weightsFor(m).sipsin, 0) / ALL_MODES.length;
    const avgOhaeng = ALL_MODES.reduce((s, m) => s + weightsFor(m).ohaeng, 0) / ALL_MODES.length;
    // 평균이 기본값 범위 내 (±10p 재분배이므로 평균은 0.40±0.10, 0.30±0.10)
    expect(avgHap).toBeGreaterThanOrEqual(0.30);
    expect(avgHap).toBeLessThanOrEqual(0.50);
    expect(avgSipsin).toBeGreaterThanOrEqual(0.20);
    expect(avgSipsin).toBeLessThanOrEqual(0.40);
    expect(avgOhaeng).toBeGreaterThanOrEqual(0.25);
    expect(avgOhaeng).toBeLessThanOrEqual(0.35);
  });
});

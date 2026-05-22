import { describe, expect, it } from 'vitest';
import {
  formatTemperatureDelta,
  formatTodayTemperature,
  scoreDeltaToTemperatureDelta,
  scoreToTemperature,
  temperatureBandFromScore,
} from '@/lib/scoring/temperature';

describe('scoreToTemperature', () => {
  it('50점을 기준 체온 37.0°C로 표시한다', () => {
    expect(scoreToTemperature(50)).toBe(37.0);
    expect(formatTodayTemperature(50)).toBe('37.0°C');
  });

  it('60점은 37.5°C, 62점은 좋은 흐름 기준 초과인 37.6°C로 표시한다', () => {
    expect(formatTodayTemperature(60)).toBe('37.5°C');
    expect(formatTodayTemperature(62)).toBe('37.6°C');
  });

  it('40점은 36.5°C, 35점은 나쁜 흐름 기준 미만인 36.3°C로 표시한다', () => {
    expect(formatTodayTemperature(40)).toBe('36.5°C');
    expect(formatTodayTemperature(35)).toBe('36.3°C');
  });

  it('극단값은 서비스 표시 범위로 클램프한다', () => {
    expect(formatTodayTemperature(-10)).toBe('35.5°C');
    expect(formatTodayTemperature(120)).toBe('38.9°C');
  });

  it('점수 변화량도 온도 변화량으로 변환한다', () => {
    expect(scoreDeltaToTemperatureDelta(15)).toBe(0.8);
    expect(scoreDeltaToTemperatureDelta(-18)).toBe(-0.9);
    expect(formatTemperatureDelta(15)).toBe('+0.8°C');
    expect(formatTemperatureDelta(-18)).toBe('-0.9°C');
  });

  it('체온 구간을 결정형으로 분류한다', () => {
    expect(temperatureBandFromScore(35)).toBe('cold');
    expect(temperatureBandFromScore(45)).toBe('cool');
    expect(temperatureBandFromScore(60)).toBe('steady');
    expect(temperatureBandFromScore(62)).toBe('warm');
    expect(temperatureBandFromScore(80)).toBe('hot');
  });
});

// 진태양시 보정 (ADR-021 Amended 2026-06-11 — 시주 판정 전용).
// 보정시 = 벽시계(KST) + 경도항((경도−135°)×4분/°) + 균시차(Spencer 1971).
// 결정형: 날짜·시각·경도만으로 결정 (ADR-035 적합). 년/월/일주에는 적용하지 않는다 —
// 일주는 KASI 진본 앵커(G0 게이트) 유지, 시지(時支) 판정에만 사용.

import { KST_STANDARD_MERIDIAN } from './constants';

export interface SolarDate {
  year: number;
  month: number;
  day: number;
}

// 양력 기준 연중 일수(1~366). 음력 입력 출생자는 반드시 양력 변환 후 날짜를 넘길 것 —
// 한 달 어긋나면 균시차가 최대 ~10분 틀어진다.
export function dayOfYear(d: SolarDate): number {
  const t = Date.UTC(d.year, d.month - 1, d.day);
  const jan1 = Date.UTC(d.year, 0, 1);
  return Math.floor((t - jan1) / 86_400_000) + 1;
}

// 균시차(분) — Spencer(1971) 푸리에 근사. 천문력 대비 오차 ~±0.6분.
// 연중 −14분(2월 중순) ~ +16분(11월 초) 사이를 오간다.
export function equationOfTimeMinutes(d: SolarDate): number {
  const n = dayOfYear(d);
  const b = (2 * Math.PI * (n - 1)) / 365;
  return (
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(b) -
      0.032077 * Math.sin(b) -
      0.014615 * Math.cos(2 * b) -
      0.04089 * Math.sin(2 * b))
  );
}

// 벽시계(KST) 시각 → 진태양시 분 총합. 자정을 넘는 보정을 표현하기 위해
// 음수·1440 초과를 허용한다 (시지 판정 측에서 정규화).
export function apparentSolarMinutes(
  hour: number,
  minute: number,
  longitude: number,
  d: SolarDate,
): number {
  const longitudeMinutes = (longitude - KST_STANDARD_MERIDIAN) * 4;
  return hour * 60 + minute + longitudeMinutes + equationOfTimeMinutes(d);
}

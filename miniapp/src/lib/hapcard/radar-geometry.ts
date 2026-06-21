/**
 * radar-geometry.ts — 오각 레이더 정점 좌표 (결정형, 단일 출처)
 *
 * me 오행 레이더(components/me/ohaeng-radar)와 합카드 오버레이 레이더
 * (components/hapcard/primitives/mini-radar)가 동일한 12시 시작·시계방향
 * 정점 순서 수식을 공유하도록 단일화한다. 한쪽에서 시작각/정점 순서를
 * 바꿔도 다른 레이더가 조용히 발산하지 않게 하기 위함.
 * 크기 상수(cx/cy/rMax)는 호출부가 주입한다(스타일/뷰박스 분리).
 */

export interface RadarDims {
  cx: number;
  cy: number;
  rMax: number;
}

/** axisCount 축 중 index 번째 정점(scale 0~1) 좌표 — 12시에서 시계방향. */
export function radarVertex(
  index: number,
  scale: number,
  { cx, cy, rMax }: RadarDims,
  axisCount: number,
): [number, number] {
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / axisCount;
  return [cx + scale * rMax * Math.cos(angle), cy + scale * rMax * Math.sin(angle)];
}

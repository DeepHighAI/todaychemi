import { describe, expect, it } from 'vitest';

import { radarVertex } from './radar-geometry';

const DIMS = { cx: 100, cy: 100, rMax: 70 };

describe('radarVertex', () => {
  it('index 0 은 12시 방향(위) 정점', () => {
    const [x, y] = radarVertex(0, 1, DIMS, 5);
    expect(x).toBeCloseTo(100, 5);
    expect(y).toBeCloseTo(30, 5); // cy - rMax
  });

  it('scale 0 은 중심점', () => {
    expect(radarVertex(2, 0, DIMS, 5)).toEqual([100, 100]);
  });

  it('5축 2번째 정점(index 1)은 우측·최상단보다 아래로 진행한다(시계방향)', () => {
    const [x, y] = radarVertex(1, 1, DIMS, 5);
    expect(x).toBeGreaterThan(100); // 중심보다 오른쪽
    expect(y).toBeGreaterThan(30); // 12시 정점보다 아래
    expect(y).toBeLessThan(100); // 아직 중심 위쪽
  });

  it('scale 에 선형 비례한다', () => {
    const half = radarVertex(0, 0.5, DIMS, 5);
    expect(half).toEqual([100, 65]); // cy - rMax*0.5
  });
});

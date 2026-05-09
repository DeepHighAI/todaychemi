import { describe, it, expect } from 'vitest';
import { KASI_SEED_INPUTS } from '../../scripts/lib/kasi-seed-inputs';

describe('KASI_SEED_INPUTS', () => {
  it('contains exactly 100 samples', () => {
    expect(KASI_SEED_INPUTS).toHaveLength(100);
  });

  it('has normal=50, boundary=30, edge=20', () => {
    const normal = KASI_SEED_INPUTS.filter((s) => s.category === 'normal').length;
    const boundary = KASI_SEED_INPUTS.filter((s) => s.category === 'boundary').length;
    const edge = KASI_SEED_INPUTS.filter((s) => s.category === 'edge').length;
    expect(normal).toBe(50);
    expect(boundary).toBe(30);
    expect(edge).toBe(20);
  });

  it('has all unique ids', () => {
    const ids = KASI_SEED_INPUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('E016 (1976 윤8월) has leap=true', () => {
    const e016 = KASI_SEED_INPUTS.find((s) => s.id === 'E016');
    expect(e016).toBeDefined();
    expect(e016?.input.leap).toBe(true);
    expect(e016?.input.calendar).toBe('lunar');
  });
});

import { describe, it, expect } from 'vitest';
import { pillarDescriptor } from '@/lib/saju/pillarDescriptor';

describe('pillarDescriptor', () => {
  it('returns year pillar metadata', () => {
    const p = pillarDescriptor('년');
    expect(p.ko_short).toBe('년주');
    expect(p.ko_long).toBe('태어난 해의 기둥');
    expect(p.hanja).toBe('年柱');
  });

  it('returns month pillar metadata', () => {
    const p = pillarDescriptor('월');
    expect(p.ko_short).toBe('월주');
    expect(p.ko_long).toBe('태어난 달의 기둥');
    expect(p.hanja).toBe('月柱');
  });

  it('returns day pillar metadata', () => {
    const p = pillarDescriptor('일');
    expect(p.ko_short).toBe('일주');
    expect(p.ko_long).toBe('태어난 날의 기둥');
    expect(p.hanja).toBe('日柱');
  });

  it('returns hour pillar metadata', () => {
    const p = pillarDescriptor('시');
    expect(p.ko_short).toBe('시주');
    expect(p.ko_long).toBe('태어난 시간의 기둥');
    expect(p.hanja).toBe('時柱');
  });

  it('throws for unknown pillar key', () => {
    expect(() => pillarDescriptor('기타' as '년')).toThrow();
  });
});

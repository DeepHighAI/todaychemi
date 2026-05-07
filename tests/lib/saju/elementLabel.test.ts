import { describe, it, expect } from 'vitest';
import { elementLabel } from '@/lib/saju/elementLabel';

describe('elementLabel', () => {
  it('returns wood element metadata', () => {
    const e = elementLabel('목');
    expect(e.ko).toBe('목');
    expect(e.hanja).toBe('木');
    expect(e.color_class).toBe('bg-element-wood');
  });

  it('returns fire element metadata', () => {
    const e = elementLabel('화');
    expect(e.ko).toBe('화');
    expect(e.hanja).toBe('火');
    expect(e.color_class).toBe('bg-element-fire');
  });

  it('returns earth element metadata', () => {
    const e = elementLabel('토');
    expect(e.ko).toBe('토');
    expect(e.hanja).toBe('土');
    expect(e.color_class).toBe('bg-element-earth');
  });

  it('returns metal element metadata', () => {
    const e = elementLabel('금');
    expect(e.ko).toBe('금');
    expect(e.hanja).toBe('金');
    expect(e.color_class).toBe('bg-element-metal');
  });

  it('returns water element metadata', () => {
    const e = elementLabel('수');
    expect(e.ko).toBe('수');
    expect(e.hanja).toBe('水');
    expect(e.color_class).toBe('bg-element-water');
  });

  it('throws for unknown element', () => {
    expect(() => elementLabel('기타' as '목')).toThrow();
  });
});

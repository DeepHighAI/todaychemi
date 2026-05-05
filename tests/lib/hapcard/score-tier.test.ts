import { describe, it, expect } from 'vitest';
import { scoreToTier } from '@/lib/hapcard/score-tier';

describe('scoreToTier', () => {
  it('0 → weak', () => expect(scoreToTier(0)).toBe('weak'));
  it('39 → weak', () => expect(scoreToTier(39)).toBe('weak'));
  it('40 → fair', () => expect(scoreToTier(40)).toBe('fair'));
  it('59 → fair', () => expect(scoreToTier(59)).toBe('fair'));
  it('60 → good', () => expect(scoreToTier(60)).toBe('good'));
  it('79 → good', () => expect(scoreToTier(79)).toBe('good'));
  it('80 → great', () => expect(scoreToTier(80)).toBe('great'));
  it('100 → great', () => expect(scoreToTier(100)).toBe('great'));
});

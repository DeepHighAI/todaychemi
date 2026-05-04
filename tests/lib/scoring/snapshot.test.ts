import { describe, it, expect } from 'vitest';
import { computeScore } from '@/lib/scoring';
import type { Mode } from '@/types/mode';
import { loadFixtureChart, type RawFixtureEntry } from './_fixtureAdapter';
import fixture from '../../fixtures/kasi_reference_100.json';

const MODES: Mode[] = ['일합', '친구합', '돈합', '첫합', '썸합', '오래합'];

const entries = (fixture as RawFixtureEntry[]).slice(0, 10);

describe('computeScore — snapshot lock (G0 fixture 5쌍 × 6모드)', () => {
  for (let i = 0; i < 5; i++) {
    const self = loadFixtureChart(entries[i * 2]!);
    const relation = loadFixtureChart(entries[i * 2 + 1]!);

    for (const mode of MODES) {
      it(`pair_${i}_mode_${mode}`, () => {
        const out = computeScore({ self, relation, mode });
        expect(out).toMatchSnapshot();
      });
    }
  }
});

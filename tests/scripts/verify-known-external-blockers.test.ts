import { describe, expect, it } from 'vitest';

import { getGateCoverageProblems } from '../../scripts/verify-known-external-blockers';

const EXPECTED_REQUIRED_GATE_NAMES = [
  'launch env',
  'Secret/public env boundary readiness',
  'Launch audit artifact readiness',
  'External settings checklist readiness',
  'TypeScript check',
  'Lint check',
  'Unit test suite',
  'Production build',
  'Auth readiness',
  'OpenAI/ZDR readiness',
  'LLM/score boundary readiness',
  'LLM resilience readiness',
  'payment DB readiness',
  'payment flow readiness',
  'Toss live readiness',
  'billing policy readiness',
  'DB/RLS readiness',
  'Supabase migration dry-run',
  'Supabase RPC security readiness',
  'Vercel readiness',
  'Operations/E2E readiness',
  'Supply-chain readiness',
  'Public E2E readiness',
  'Auth E2E readiness',
  'Core E2E coverage readiness',
];

function gateResults(names = EXPECTED_REQUIRED_GATE_NAMES) {
  return names.map((name) => ({
    name,
    required: true,
    status: 'pass',
    timedOut: false,
  }));
}

describe('verify-known-external-blockers gate coverage', () => {
  it('accepts a launch summary that includes every launch-required gate', () => {
    expect(getGateCoverageProblems(gateResults())).toEqual([]);
  });

  it('flags partial summaries that omit a launch-required gate', () => {
    const results = gateResults(EXPECTED_REQUIRED_GATE_NAMES.filter((name) => name !== 'Production build'));

    expect(getGateCoverageProblems(results)).toEqual([
      'Production build: missing required gate result',
    ]);
  });

  it('flags unexpected or duplicate required gate rows', () => {
    const results = [
      ...gateResults(),
      {
        name: 'Production build',
        required: true,
        status: 'pass',
        timedOut: false,
      },
      {
        name: 'non-launch smoke',
        required: true,
        status: 'pass',
        timedOut: false,
      },
    ];

    expect(getGateCoverageProblems(results)).toEqual([
      'non-launch smoke: unexpected required gate result',
      'Production build: duplicate required gate result',
    ]);
  });
});

import type { ChartCore } from '@/types/chart';
import type { Mode } from '@/types/mode';
import type { ScoringOutput } from '@/types/scoring';
import { SCORING_VERSION } from '@/lib/scoring/constants';
import { computeFinalScore } from '@/lib/scoring/final';
import { computeScenarioEstimate } from '@/lib/scoring/scenarioEstimate';

export function computeScore(args: {
  self: ChartCore;
  relation: ChartCore;
  mode: Mode;
  scoring_version?: number;
}): ScoringOutput {
  const { self, relation, mode, scoring_version = SCORING_VERSION } = args;

  const { score, components, mode_adjustment } = computeFinalScore(self, relation, mode);

  const scenarioResult = computeScenarioEstimate(self, relation, mode);
  const scenario_estimate = scenarioResult.is_estimated ? scenarioResult : null;

  return {
    score,
    components,
    mode_adjustment,
    scenario_estimate,
    scoring_version,
  };
}

import type { Mode } from './mode';
import type { ChartHash } from './chart';

export interface ScoringComponents {
  hap_chung_hyung_hae: number;
  sipsin: number;
  ohaeng: number;
}

export interface ScoringOutput {
  score: number;
  components: ScoringComponents;
  mode_adjustment: number;
  yunse_adjustment: number;
  scenario_estimate: {
    is_estimated: boolean;
    display_score: number;
    display_range: number;
    needs_badge: boolean;
  } | null;
  scoring_version: number;
}

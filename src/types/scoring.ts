import type { Mode } from './mode';
import type { ChartHash } from './chart';

export interface ScoringInput {
  user_chart_hash: ChartHash;
  relation_chart_hash: ChartHash;
  mode: Mode;
  scoring_version: number;
  ilji_date: string;
}

export interface ScoringComponents {
  hap_chung_hyung_hae: number;
  sipsin: number;
  ohaeng: number;
}

export interface ScoringOutput {
  score: number;
  components: ScoringComponents;
  mode_adjustment: number;
  scenario_estimate: {
    is_estimated: boolean;
    display_score: number;
    display_range: number;
    needs_badge: boolean;
  } | null;
  scoring_version: number;
}

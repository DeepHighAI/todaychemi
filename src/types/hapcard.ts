import type { Mode } from './mode';

export type HapcardComponent =
  | 'header'
  | 'gauge'
  | 'ohaeng_map'
  | 'body_3section'
  | 'evidence'
  | 'footer'
  | 'glossary'
  | 'mini_radar';

export interface HapcardResult {
  id: string;
  user_id: string;
  relation_id: string;
  mode: Mode;
  prompt_version: string;
  scoring_version: number;
  score: number;
  score_components: {
    hap_chung_hyung_hae: number;
    sipsin: number;
    ohaeng: number;
    mode_adjustment: number;
  };
  body_summary: string;
  body_detail: string;
  evidence: {
    sipsin_mappings: Array<{ name: string; effect: string }>;
    classics_quotes: Array<{ source: string; original: string; modern: string }>;
    daily_influences: { ilji: string; jueun: string; woolun: string };
  };
  viewport_priority: HapcardComponent[];
  computed_at: string;
  expires_at: string;
}

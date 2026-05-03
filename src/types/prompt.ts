import type { Mode } from './mode';

export type PromptStatus = 'active' | 'canary' | 'rolled_back';

export interface PromptVersion {
  id: string;
  mode: Mode;
  model_name: 'gpt-5' | 'gpt-5o' | 'gpt-5-mini' | 'claude-sonnet-4-6' | 'claude-haiku-4-5-20251001';
  version_label: string;
  prompt_text: string;
  banned_phrases_version: string;
  canary_pct: number;
  status: PromptStatus;
  created_at: string;
}

export interface BannedPhraseHit {
  id: string;
  prompt_version_id: string;
  phrase: string;
  raw_output_excerpt: string;
  created_at: string;
}

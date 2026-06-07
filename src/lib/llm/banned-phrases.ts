import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

export interface BannedPhraseCategory {
  category: string;
  description: string;
  phrases: string[];
}

export type BannedHit =
  | { found: true; category: string; phrase: string }
  | { found: false };

interface CatalogYaml {
  categories: Record<string, { description: string; phrases: string[] }>;
}

export function loadBannedPhrases(catalogYaml?: string): BannedPhraseCategory[] {
  const raw =
    catalogYaml ??
    readFileSync(join(process.cwd(), 'prompts', 'banned_phrases_catalog.yaml'), 'utf-8');

  const parsed = parse(raw) as CatalogYaml;
  return Object.entries(parsed.categories).map(([category, val]) => ({
    category,
    description: val.description,
    phrases: val.phrases,
  }));
}

export function findBannedPhrase(
  text: string,
  catalog: BannedPhraseCategory[],
): BannedHit {
  for (const cat of catalog) {
    for (const phrase of cat.phrases) {
      if (text.includes(phrase)) {
        return { found: true, category: cat.category, phrase };
      }
    }
  }
  return { found: false };
}

/** CJK Unified Ideographs U+4E00–U+9FFF. ADR-038. */
const CLASSICAL_HANJA_RE = /[一-鿿]/;

// ADR-035 §8 점수 누설 회귀 차단
const SCORE_LEAK_PATTERNS = [
  /(\d{1,3})\s*점/,
  /\bscore\b["']?\s*[:：]?\s*\d/i,
  /["']?(?:today_)?(?:compat|compatibility)_score["']?\s*[:：]?\s*\d/i,
  /합점수\s*\d/,
];

export function findScoreLeak(text: string): BannedHit {
  for (const re of SCORE_LEAK_PATTERNS) {
    if (re.test(text)) {
      return { found: true, category: 'score_leak', phrase: text.match(re)![0] };
    }
  }
  return { found: false };
}

/** CJK Unified Ideographs 범위에서 한자 존재 여부 확인 (U+4E00–U+9FFF). ADR-038. */
export function containsClassicalHanja(text: string): BannedHit {
  // 한자가 없으면 조기 반환
  if (!text) return { found: false };
  const match = text.match(CLASSICAL_HANJA_RE);
  if (!match) return { found: false };
  return { found: true, category: 'classical_hanja', phrase: match[0] };
}

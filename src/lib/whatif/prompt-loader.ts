import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DiagnosticType } from '@/types/diagnostic';

const VERSION_RE = /^>?\s*Version:\s*(v[\d.]+)/m;

export interface WhatifPrompt {
  content: string;
  version: string;
}

export function loadWhatifPrompt(type: DiagnosticType): WhatifPrompt {
  const filePath = join(process.cwd(), 'prompts', 'system', 'whatif', `${type}.md`);
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    throw new Error(`WHATIF_PROMPT_NOT_FOUND: ${type}`);
  }
  const match = VERSION_RE.exec(content);
  if (!match) {
    throw new Error(`WHATIF_PROMPT_VERSION_MISSING: ${type}`);
  }
  return { content, version: match[1] };
}

import type { GlossaryKey } from '@/types/glossary';

export type SoftTerm = '끌림' | '긴장' | '부딪힘' | '소모';

export const SOFT_TO_CLASSICAL: Record<SoftTerm, GlossaryKey> = {
  끌림: '합',
  긴장: '형',
  부딪힘: '충',
  소모: '해',
};

export const CLASSICAL_TO_SOFT: Partial<Record<GlossaryKey, SoftTerm>> = {
  합: '끌림',
  형: '긴장',
  충: '부딪힘',
  해: '소모',
};

export function toClassicalKey(token: string): string {
  return SOFT_TO_CLASSICAL[token as SoftTerm] ?? token;
}

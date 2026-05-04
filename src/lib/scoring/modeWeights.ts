import type { Mode } from '@/types/mode';
import { MODE_WEIGHTS } from '@/lib/scoring/constants';

// §6 6모드별 가중치 반환 — MODE_WEIGHTS 상수의 단순 래퍼
export function weightsFor(mode: Mode): { hap: number; sipsin: number; ohaeng: number } {
  return MODE_WEIGHTS[mode];
}

import type { ChartCore } from '@/types/chart';
import type { Mode } from '@/types/mode';
import type { ScoringComponents } from '@/types/scoring';
import {
  computeHapChungHyungHaeRaw,
  normalizeHapChungHyungHae,
} from '@/lib/scoring/hapChungHyungHae';
import { computeSipsinScore } from '@/lib/scoring/sipsin';
import { computeOhaengScore } from '@/lib/scoring/ohaeng';
import { weightsFor } from '@/lib/scoring/modeWeights';
import { computeYunseAdjustment } from '@/lib/scoring/yunseAdjustment';

// §1 가중 합산 + §7 clamp + round
export function computeFinalScore(
  self: ChartCore,
  relation: ChartCore,
  mode: Mode,
): { score: number; components: ScoringComponents; mode_adjustment: number; yunse_adjustment: number } {
  const w = weightsFor(mode);

  const hapEvents = computeHapChungHyungHaeRaw(self, relation);
  const sHap = normalizeHapChungHyungHae(hapEvents);
  const sSipsin = computeSipsinScore(self.day_pillar[0], relation, mode);
  const sOhaeng = computeOhaengScore(self, relation);
  const yunseAdj = computeYunseAdjustment(self.yunse, relation.day_pillar, mode);

  const raw = w.hap * sHap + w.sipsin * sSipsin + w.ohaeng * sOhaeng + yunseAdj;

  return {
    score: Math.round(Math.max(0, Math.min(100, raw))),
    components: {
      hap_chung_hyung_hae: sHap,
      sipsin: sSipsin,
      ohaeng: sOhaeng,
    },
    mode_adjustment: 0, // 모드 조정은 가중치에 반영됨
    yunse_adjustment: yunseAdj,
  };
}

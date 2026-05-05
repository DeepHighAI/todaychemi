import type { ChartCore } from '@/types/chart';
import type { HapcardVisuals } from '@/types/hapcard';

function pickVisualSlice(c: ChartCore): HapcardVisuals['user'] {
  return {
    day_pillar: c.day_pillar,
    day_master_element: c.day_master_element,
    five_elements_counts: c.five_elements_counts,
  };
}

export function deriveVisuals(self: ChartCore, relation: ChartCore): HapcardVisuals {
  return {
    user: pickVisualSlice(self),
    relation: pickVisualSlice(relation),
  };
}

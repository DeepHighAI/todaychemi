import { toPercent } from '@/lib/hapcard/ohaeng-percent';
import { elementLabel, type OhaengElement } from '@/lib/saju/elementLabel';

const ELEMENTS: OhaengElement[] = ['목', '화', '토', '금', '수'];

interface OhaengBarsProps {
  data: Record<OhaengElement, number>;
}

const BAR_MAX_PX = 48;

export function OhaengBars({ data }: OhaengBarsProps) {
  const percents = toPercent(data);
  return (
    <div className="flex gap-1 items-end">
      {ELEMENTS.map((el) => {
        const { color_class, hanja } = elementLabel(el);
        const pct = Math.round(percents[el]);
        return (
          <div key={el} className="flex-1 flex flex-col items-center gap-1">
            <div
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={el}
              title={hanja}
              style={{ height: `${Math.round(pct * BAR_MAX_PX / 100)}px` }}
              className={`w-full rounded-sm ${color_class}`}
            />
            <span className="text-[10px] text-muted-foreground">{el}</span>
          </div>
        );
      })}
    </div>
  );
}

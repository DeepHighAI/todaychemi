import { toPercent } from '@/lib/hapcard/ohaeng-percent';

type OhaengKey = '목' | '화' | '토' | '금' | '수';

const ELEMENTS: OhaengKey[] = ['목', '화', '토', '금', '수'];

const elementClass: Record<OhaengKey, string> = {
  목: 'bg-element-wood',
  화: 'bg-element-fire',
  토: 'bg-element-earth',
  금: 'bg-element-metal',
  수: 'bg-element-water',
};

interface OhaengBarsProps {
  data: Record<OhaengKey, number>;
}

export function OhaengBars({ data }: OhaengBarsProps) {
  const percents = toPercent(data);
  return (
    <div className="flex gap-1 items-end h-16">
      {ELEMENTS.map((el) => {
        const pct = Math.round(percents[el]);
        return (
          <div key={el} className="flex-1 flex flex-col items-center gap-1">
            <div
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={el}
              style={{ height: `${pct}%` }}
              className={`w-full rounded-sm ${elementClass[el]}`}
            />
            <span className="text-[10px] text-muted-foreground">{el}</span>
          </div>
        );
      })}
    </div>
  );
}

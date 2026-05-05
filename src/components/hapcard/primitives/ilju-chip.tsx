type OhaengElement = '목' | '화' | '토' | '금' | '수';

const elementClass: Record<OhaengElement, string> = {
  목: 'bg-element-wood',
  화: 'bg-element-fire',
  토: 'bg-element-earth',
  금: 'bg-element-metal',
  수: 'bg-element-water',
};

interface IljuChipProps {
  pillar: string;
  element: OhaengElement;
}

export function IljuChip({ pillar, element }: IljuChipProps) {
  return (
    <span
      className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold text-white ${elementClass[element]}`}
    >
      {pillar}
    </span>
  );
}

import { elementLabel, type OhaengElement } from '@/lib/saju/elementLabel';
import { convertHanja } from '@/lib/glossary/post-process';

interface IljuChipProps {
  pillar: string;
  element: OhaengElement;
}

export function IljuChip({ pillar, element }: IljuChipProps) {
  const { color_class, hanja } = elementLabel(element);
  return (
    <span
      title={hanja}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold text-white ${color_class}`}
    >
      {convertHanja(pillar)}
    </span>
  );
}

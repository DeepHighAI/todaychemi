/**
 * ilju-chip.tsx — 일주(日柱) 표시 칩 (미니앱 포트)
 *
 * 웹앱 원본: src/components/hapcard/primitives/ilju-chip.tsx
 * 미니앱: Tailwind bg-element-* → tokens.css --accent-* 인라인 스타일.
 * ADR-038: convertHanja() 경유해 한자 미노출.
 */

import { elementLabel, type OhaengElement } from '@/lib/saju/elementLabel';
import { convertHanja } from '@/lib/glossary/post-process';

interface IljuChipProps {
  pillar: string;
  element: OhaengElement;
}

export function IljuChip({ pillar, element }: IljuChipProps) {
  const { hanja, color } = elementLabel(element);
  return (
    <span
      title={hanja}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        borderRadius: '50%',
        fontSize: 12,
        fontWeight: 700,
        color: '#fff',
        backgroundColor: color,
        flexShrink: 0,
      }}
    >
      {convertHanja(pillar)}
    </span>
  );
}

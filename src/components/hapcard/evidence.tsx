'use client';

import { useTranslations } from 'next-intl';
import { useGlossaryContext } from '@/components/hapcard/glossary-provider';
import { TermTooltip } from '@/components/hapcard/primitives/term-tooltip';
import { toClassicalKey } from '@/lib/glossary/soft-term-map';

interface WhyCard {
  title: string;
  reason: string;
}

interface HapcardEvidenceProps {
  cards: WhyCard[];
}

// 앞 글자가 한글 음절이 아닐 때만 용어로 인식 (예: "썸합"의 "합"은 제외)
// 소프트 용어(끌림/긴장/부딪힘/소모)도 인식 — LLM v0.3 출력 및 과거 캐시 classical 토큰 모두 지원
const GLOSSARY_TERM_SOURCE = '(?<![가-힣ㄱ-ㅎㅏ-ㅣ])(일주|십신|합|형|충|해|끌림|긴장|부딪힘|소모)';

function parseWithGlossary(
  text: string,
  consume: (term: string) => boolean,
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = new RegExp(GLOSSARY_TERM_SOURCE, 'g');
  let lastIndex = 0;

  for (const match of text.matchAll(re)) {
    const term = match[1];
    const start = match.index ?? 0;

    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }

    const classicalKey = toClassicalKey(term);
    const isFirst = consume(classicalKey);
    nodes.push(
      <TermTooltip key={start} term={classicalKey} defaultOpen={isFirst}>
        {term}
      </TermTooltip>,
    );

    lastIndex = start + term.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

export function HapcardEvidence({ cards }: HapcardEvidenceProps) {
  const t = useTranslations('hapcard');
  const { consume } = useGlossaryContext();

  return (
    <div data-testid="hapcard-evidence" className="rounded-2xl bg-card p-6 space-y-3">
      <p className="text-sm font-semibold text-foreground">{t('evidence.title')}</p>
      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('evidence.empty')}</p>
      ) : (
        <ul className="space-y-3">
          {cards.map((card, i) => (
            <li key={i} className="border border-border rounded-xl p-3 space-y-1">
              <p className="text-sm font-medium text-foreground">
                {parseWithGlossary(card.title, consume)}
              </p>
              <p className="text-xs text-muted-foreground">
                {parseWithGlossary(card.reason, consume)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

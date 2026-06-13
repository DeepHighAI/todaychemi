'use client';

import { useTranslations } from 'next-intl';
import { useGlossaryContext } from '@/components/hapcard/glossary-provider';
import { TermTooltip } from '@/components/hapcard/primitives/term-tooltip';
import { toClassicalKey, SOFT_TO_CLASSICAL } from '@/lib/glossary/soft-term-map';
import { GLOSSARY_TERMS } from '@/lib/glossary/terms';

interface WhyCard {
  title: string;
  reason: string;
}

interface HapcardEvidenceProps {
  cards: WhyCard[];
}

// 카탈로그 키 + 소프트 alias를 longest-first 정렬로 합쳐 regex 생성.
// 긴 compound term이 짧은 단일자보다 먼저 매치되도록 보장 (예: "자오충" > "충").
const _CATALOG_AND_SOFT = [
  ...Object.keys(GLOSSARY_TERMS),
  ...Object.keys(SOFT_TO_CLASSICAL),
].sort((a, b) => b.length - a.length);

// 경계 단언:
// - lookbehind: 앞 글자가 한글이면 용어 외부로 판단해 제외 (예: "썸합"의 "합").
// - lookahead: 뒤 글자가 한글이면 합성어 내부로 판단 (예: "충돌"의 "충", "해석"의 "해").
const _LOOKBEHIND = '(?<![가-힣ㄱ-ㅎㅏ-ㅣ])';
const _LOOKAHEAD = '(?![가-힣ㄱ-ㅎㅏ-ㅣ])';

// 단일글자 classical 용어(합/형/충/해)만 양쪽 경계를 요구해 합성어("충돌"·"해석") 오매칭을 막는다.
// 다중글자 용어(자오충·부딪힘 등)는 lookbehind 만 두어 조사가 붙어도("부딪힘이") 매칭한다.
const _MULTI_ALT = _CATALOG_AND_SOFT.filter((t) => Array.from(t).length > 1).join('|');
const _SINGLE = _CATALOG_AND_SOFT.filter((t) => Array.from(t).length === 1);
const _SINGLE_PART = _SINGLE.length > 0 ? `|(?:${_SINGLE.join('|')})${_LOOKAHEAD}` : '';
const GLOSSARY_TERM_SOURCE = `${_LOOKBEHIND}(${_MULTI_ALT}${_SINGLE_PART})`;

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
      <p className="font-eyebrow text-primary">{t('evidence.title')}</p>
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

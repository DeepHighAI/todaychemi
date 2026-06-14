/**
 * evidence.tsx — 명리 근거 카드 + 용어 툴팁 (미니앱 포트)
 *
 * 웹앱 원본: src/components/hapcard/evidence.tsx
 * 변경: Tailwind → 인라인 스타일, 'use client' 제거.
 */

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

// 카탈로그 키 + 소프트 alias longest-first 정렬 (evidence.tsx 와 동일 로직)
const _CATALOG_AND_SOFT = [
  ...Object.keys(GLOSSARY_TERMS),
  ...Object.keys(SOFT_TO_CLASSICAL),
].sort((a, b) => b.length - a.length);

const _LOOKBEHIND = '(?<![가-힣ㄱ-ㅎㅏ-ㅣ])';
const _LOOKAHEAD = '(?![가-힣ㄱ-ㅎㅏ-ㅣ])';

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
    <div data-testid="hapcard-evidence" style={{ borderRadius: 16, backgroundColor: 'var(--bg-card)', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ font: 'var(--t-cap)', color: 'var(--primary)', margin: 0 }}>{t('evidence.title')}</p>
      {cards.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>{t('evidence.empty')}</p>
      ) : (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: 0, padding: 0, listStyle: 'none' }}>
          {cards.map((card, i) => (
            <li key={i} style={{ border: '1px solid var(--hairline)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
                {parseWithGlossary(card.title, consume)}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                {parseWithGlossary(card.reason, consume)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

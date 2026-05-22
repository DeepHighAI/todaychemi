import { convertHanja } from '@/lib/glossary/post-process';

type CoachCard = {
  title?: string;
  reason?: string;
  summary?: string;
};

export type HeroCoachLine = {
  key: 'good' | 'caution' | 'tip';
  label: '"좋아!"' | '"조심!"' | '"이렇게 해봐!"';
  body: string;
};

export type DetailSummaryLine = {
  key: 'conclusion' | 'strength' | 'caution';
  label: '결론' | '강점' | '주의';
  body: string;
};

const CARD_ACTION_COUNT = 3;

const LABEL_START =
  /(강점|주의점|주의|다만|반면|아쉬운 점|조심할 점)(?:으로는|은|는|:|,)?/;

const CAUTION_PATTERN = /주의|조심|경계|부족|충돌|부딪|긴장|오해|불안|불확실|중복|약점|피로|마찰|소모|부담|어색|느릴|느림|엇갈/;
const GOOD_PATTERN = /강점|좋|장점|편안|보완|시너지|매력|신뢰|안정|끌림|케미|성장|활기|유대|공감/;

function normalizeInline(text: string): string {
  return text.replace(/[ \t\f\v]+/g, ' ').trim();
}

function splitSentences(text: string): string[] {
  return (
    text
      .match(/[^.!?。]+[.!?。]+|[^.!?。]+$/g)
      ?.map(normalizeInline)
      .filter(Boolean) ?? []
  );
}

function insertLabelBreaks(text: string): string {
  return text
    .replace(new RegExp(`([.!?。])\\s*(?=${LABEL_START.source})`, 'g'), '$1\n')
    .replace(new RegExp(`\\s+(?=${LABEL_START.source})`, 'g'), '\n');
}

function stripLeadLabel(text: string): string {
  return text
    .replace(/^(결론|강점|주의점|주의|좋은 점|조심할 점|이렇게 해봐)\s*[:：]\s*/u, '')
    .replace(/^(강점|주의점|주의)(?:으로는|은|는)\s*/u, '')
    .trim();
}

function parseDetailSummaryLine(line: string, index: number): DetailSummaryLine {
  const fallback = [
    { key: 'conclusion', label: '결론' },
    { key: 'strength', label: '강점' },
    { key: 'caution', label: '주의' },
  ] as const;
  const normalized = normalizeInline(line);
  const match = normalized.match(/^(결론|강점|주의점|주의)(?:으로는|은|는)?\s*[:：]?\s*(.*)$/u);
  const rawLabel = match?.[1];
  const fallbackItem = fallback[Math.min(index, fallback.length - 1)];
  const label =
    rawLabel === '강점'
      ? '강점'
      : rawLabel === '주의점' || rawLabel === '주의'
        ? '주의'
        : rawLabel === '결론'
          ? '결론'
          : fallbackItem.label;
  const key = label === '강점' ? 'strength' : label === '주의' ? 'caution' : 'conclusion';
  const body = normalizeInline(match?.[2] || stripLeadLabel(normalized));
  return { key, label, body };
}

function simplifyTerms(text: string): string {
  return convertHanja(text)
    .replace(/ⓘ/g, '')
    .replace(/actions\[\d+\]\s*(?:처럼|같이|로|으로|을|를|은|는)?/gi, '')
    .replace(/비견(?:\([^)]+\))?/g, '비슷한 성향')
    .replace(/[갑을병정무기경신임계]일간/g, '타고난 중심 기질')
    .replace(/일간/g, '타고난 중심 기질')
    .replace(/일주/g, '태어난 날의 기운')
    .replace(/도화와 홍염 기운/g, '눈에 띄는 매력과 빠르게 달아오르는 감정')
    .replace(/도화살(?:\([^)]+\))?/g, '눈에 띄는 매력')
    .replace(/홍염살(?:\([^)]+\))?/g, '빠르게 달아오르는 감정')
    .replace(/홍염/g, '빠르게 달아오르는 감정')
    .replace(/정관(?:\([^)]+\))?/g, '책임감과 기준')
    .replace(/편관(?:\([^)]+\))?/g, '긴장 속에서도 책임지는 성향')
    .replace(/식신(?:\([^)]+\))?/g, '편하게 표현하는 힘')
    .replace(/상관(?:\([^)]+\))?/g, '톡톡 튀는 표현 방식')
    .replace(/재성(?:\([^)]+\))?/g, '돈과 자원을 다루는 힘')
    .replace(/시지(?:\([^)]+\))?/g, '태어난 시간 정보')
    .replace(/태어난 시간 정보 정보/g, '태어난 시간 정보')
    .replace(/토 중심의 안정적 에너지라/g, '안정감을 중시하는 성향이라')
    .replace(/토 중심의 안정적 에너지/g, '안정감을 중시하는 성향')
    .replace(/토 성향/g, '안정감을 중시하는 성향')
    .replace(/토 기운/g, '차분하고 안정적인 성향')
    .replace(/토 과다/g, '안정과 책임을 중시하는 성향이 강한 상태')
    .replace(/화·수 보완/g, '추진력과 차분한 조율이 서로 채워지는 점')
    .replace(/격수|격국/g, '전체 사주 균형')
    .replace(/\([^)]*(?:기운|판단 제외|시간 미상)[^)]*\)/g, '')
    .replace(/\s+([,.!?])/g, '$1');
}

function toFriendlySentence(text: string): string {
  const first = splitSentences(stripLeadLabel(simplifyTerms(text)))[0] ?? '';
  return normalizeInline(first)
    .replace(/있습니다\.$/u, '있어요.')
    .replace(/필요합니다\.$/u, '필요해요.')
    .replace(/중요합니다\.$/u, '중요해요.')
    .replace(/불확실합니다\.$/u, '불확실해요.')
    .replace(/이어집니다\.$/u, '이어져요.')
    .replace(/눈에 띔\.$/u, '눈에 띄어요.')
    .replace(/좋음\.$/u, '좋아요.')
    .replace(/있음\.$/u, '있어요.')
    .replace(/높아집니다\.$/u, '높아져요.')
    .replace(/됩니다\.$/u, '돼요.')
    .replace(/합니다\.$/u, '해요.')
    .replace(/된다\.$/u, '돼요.')
    .replace(/줍니다\.$/u, '줘요.');
}

function cardText(card?: CoachCard): string {
  if (!card) return '';
  return card.reason || card.summary || card.title || '';
}

function pickCard(cards: CoachCard[], kind: 'good' | 'caution'): CoachCard | undefined {
  const pattern = kind === 'caution' ? CAUTION_PATTERN : GOOD_PATTERN;
  const opposite = kind === 'caution' ? GOOD_PATTERN : CAUTION_PATTERN;
  return (
    cards.find(card => pattern.test(`${card.title ?? ''} ${card.reason ?? ''} ${card.summary ?? ''}`)) ??
    cards.find(card => !opposite.test(`${card.title ?? ''} ${card.reason ?? ''} ${card.summary ?? ''}`))
  );
}

function fallbackLine(mainText: string, pattern: RegExp, fallbackIndex: number): string {
  const lines = formatHeroMainText(mainText).split('\n');
  return lines.find(line => pattern.test(line)) ?? lines[fallbackIndex] ?? lines[0] ?? '';
}

function ensureSentence(text: string, fallback: string): string {
  const value = text || fallback;
  if (!value) return fallback;
  if (/[.!?。]$/u.test(value)) return value;
  if (/[요다까자]$/u.test(value)) return `${value}.`;
  return `${value}이에요.`;
}

function comparableText(text: string): string {
  return stripLeadLabel(simplifyTerms(text))
    .replace(/[.!?。~\s"'“”‘’]/g, '')
    .trim();
}

function isSameAction(first: string, second: string): boolean {
  const a = comparableText(first);
  const b = comparableText(second);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

function normalizeActionItem(text: string): string {
  const value = toFriendlySentence(text);
  if (!value) return '';
  return /[.!?。요]$/u.test(value) ? value : `${value}.`;
}

function buildSpecificAction({
  mainText,
  whyCards,
  heroAction,
}: {
  mainText: string;
  whyCards: CoachCard[];
  heroAction: string;
}): string {
  const goodCard = pickCard(whyCards, 'good');
  const cautionCard = pickCard(whyCards.filter(card => card !== goodCard), 'caution');
  const caution = toFriendlySentence(
    cardText(cautionCard) || fallbackLine(mainText, CAUTION_PATTERN, 2),
  );
  const good = toFriendlySentence(
    cardText(goodCard) || fallbackLine(mainText, GOOD_PATTERN, 1),
  );
  const context = simplifyTerms(`${mainText} ${good} ${caution} ${heroAction}`);

  if (/페이스|속도|보폭|빠르|급하|천천|느릴|느림/u.test(context)) {
    return '상대가 먼저 다가오면 바로 맞추려 하기보다, 연락 빈도나 만나는 속도를 한 문장으로 정해보세요.';
  }
  if (/역할|책임|결정|권한|중복|업무|협업|검수|문서/u.test(context)) {
    return '시작 전에 맡을 일과 결정 기준을 한 줄씩 적어 서로 확인해보세요.';
  }
  if (/돈|예산|지출|수입|자원|금액|정산|투자/u.test(context)) {
    return '금액, 담당자, 마감일을 먼저 적고 작은 기준부터 합의해보세요.';
  }
  if (/첫\s*만남|어색|공통 관심|대화|카페|산책/u.test(context)) {
    return '처음에는 30분 안에 끝낼 수 있는 가벼운 약속과 공통 관심사 하나를 준비해보세요.';
  }
  if (/끌림|매력|설렘|감정|표현|눈치|도화|홍염/u.test(context)) {
    return '좋다는 신호는 짧게 받아주고, 내가 편한 표현 방식도 한 가지 같이 알려보세요.';
  }
  if (/오래|반복|루틴|피로|소모|회복|장기/u.test(context)) {
    return '이번 주에 유지할 루틴 하나와 쉬어갈 신호 하나를 미리 정해보세요.';
  }

  const cautionBody = caution.replace(/[.!?。]$/u, '');
  if (cautionBody) {
    return `${cautionBody}를 줄이도록 오늘 바로 할 수 있는 약속 하나를 정해보세요.`;
  }
  return '오늘 바로 해볼 수 있는 작은 약속 하나를 정하고, 끝난 뒤 서로의 느낌을 짧게 확인해보세요.';
}

export function formatHeroCoachLines({
  mainText,
  whyCards = [],
  actions = [],
}: {
  mainText: string;
  whyCards?: CoachCard[];
  actions?: string[];
}): HeroCoachLine[] {
  const goodCard = pickCard(whyCards, 'good');
  const cautionCard = pickCard(whyCards.filter(card => card !== goodCard), 'caution');
  const good = ensureSentence(
    toFriendlySentence(cardText(goodCard) || fallbackLine(mainText, /강점|좋|편안|보완|매력|신뢰|안정/u, 0)),
    '함께 있을 때 편하게 맞는 지점이 있어요.',
  );
  const caution = ensureSentence(
    toFriendlySentence(cardText(cautionCard) || fallbackLine(mainText, /주의|조심|부족|충돌|불안|중복/u, 2)),
    '서로 기대하는 속도나 표현 방식이 다를 수 있어요.',
  );
  const tip = ensureSentence(
    toFriendlySentence(actions[0] ?? ''),
    '초반에는 작은 약속부터 맞춰보면서 상대 반응을 천천히 확인해보세요.',
  );

  return [
    { key: 'good', label: '"좋아!"', body: good },
    { key: 'caution', label: '"조심!"', body: caution },
    { key: 'tip', label: '"이렇게 해봐!"', body: tip },
  ];
}

export function formatHeroCoachText(input: {
  mainText: string;
  whyCards?: CoachCard[];
  actions?: string[];
}): string {
  return formatHeroCoachLines(input)
    .map(line => `${line.label} ${line.body}`)
    .join('\n');
}

export function formatHapcardActionItems({
  mainText,
  whyCards = [],
  actions = [],
}: {
  mainText: string;
  whyCards?: CoachCard[];
  actions?: string[];
}): string[] {
  if (actions.length === 0) return [];

  const heroAction = toFriendlySentence(actions[0] ?? '');
  const sourceActions = actions.length >= CARD_ACTION_COUNT + 1
    ? actions.slice(1, CARD_ACTION_COUNT + 1)
    : actions.slice(0, CARD_ACTION_COUNT);

  return sourceActions
    .map((action, index) => {
      const actionText = normalizeActionItem(action);
      if (index === 0 && isSameAction(actionText, heroAction)) {
        return buildSpecificAction({ mainText, whyCards, heroAction });
      }
      return actionText;
    })
    .filter(Boolean);
}

export function formatHeroMainText(mainText: string): string {
  const converted = convertHanja(mainText).replace(/\r\n/g, '\n');
  const sourceLines = converted
    .split('\n')
    .map(normalizeInline)
    .filter(Boolean);

  if (sourceLines.length > 1) {
    return sourceLines.slice(0, 3).join('\n');
  }

  const oneLine = sourceLines[0] ?? '';
  const labelLines = insertLabelBreaks(oneLine)
    .split('\n')
    .map(normalizeInline)
    .filter(Boolean);

  if (labelLines.length > 1) {
    return labelLines.slice(0, 3).join('\n');
  }

  const sentenceLines = splitSentences(oneLine);
  return (sentenceLines.length > 0 ? sentenceLines : [oneLine]).slice(0, 3).join('\n');
}

export function formatDetailSummaryLines(mainText: string): DetailSummaryLine[] {
  return formatHeroMainText(mainText)
    .split('\n')
    .map((line, index) => parseDetailSummaryLine(line, index))
    .filter(line => Boolean(line.body));
}

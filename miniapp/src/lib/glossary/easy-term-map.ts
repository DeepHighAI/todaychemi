/**
 * easy-term-map.ts — G-5 쉽게 보기 평이어 사전 (웹앱과 동일, next/* 없음)
 *
 * 웹앱 원본: src/lib/glossary/easy-term-map.ts (read-only reference)
 */

export const EASY_TERM_MAP: Record<string, string> = {
  // 십신 10종
  비견: '나와 같은 기운',
  겁재: '경쟁하는 기운',
  식신: '표현하고 베푸는 기운',
  상관: '틀을 깨는 표현력',
  편재: '굴리는 재물 기운',
  정재: '차곡차곡 모으는 재물 기운',
  편관: '도전과 압박의 기운',
  정관: '규칙과 책임의 기운',
  편인: '직관적 배움의 기운',
  정인: '돌봄과 학습의 기운',
  // 십신 5그룹
  비겁: '동료 기운',
  식상: '표현 기운',
  재성: '재물 기운',
  관성: '책임 기운',
  인성: '배움 기운',
  // 파생 7종
  신강: '기운이 강한 사주',
  신약: '기운이 여린 사주',
  중화: '균형 잡힌 사주',
  용신: '균형을 잡아주는 기운',
  지장간: '지지 속에 숨은 기운',
  일간: '나를 나타내는 글자',
  일지: '태어난 날의 땅 기운',
};

// 긴 용어 우선 매칭 + 조사 캡처
const JOSA_ALTERNATION = '으로|이란|이라|이|가|은|는|을|를|과|와|로|란|라';
const EASY_TERM_PATTERN = new RegExp(
  `(${Object.keys(EASY_TERM_MAP)
    .sort((a, b) => b.length - a.length)
    .join('|')})(${JOSA_ALTERNATION})?`,
  'g',
);

function hasFinalConsonant(text: string): boolean {
  const code = text.charCodeAt(text.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 > 0;
}

function harmonizeJosa(replacement: string, josa: string): string {
  const batchim = hasFinalConsonant(replacement);
  const code = replacement.charCodeAt(replacement.length - 1);
  const isRieul = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 === 8;
  switch (josa) {
    case '이': case '가': return batchim ? '이' : '가';
    case '은': case '는': return batchim ? '은' : '는';
    case '을': case '를': return batchim ? '을' : '를';
    case '과': case '와': return batchim ? '과' : '와';
    case '으로': case '로': return batchim && !isRieul ? '으로' : '로';
    case '이란': case '란': return batchim ? '이란' : '란';
    case '이라': case '라': return batchim ? '이라' : '라';
    default: return josa;
  }
}

export function toEasyText(text: string): string {
  return text.replace(EASY_TERM_PATTERN, (_match, term: string, josa?: string) => {
    const replacement = EASY_TERM_MAP[term] ?? term;
    if (!josa) return replacement;
    return replacement + harmonizeJosa(replacement, josa);
  });
}

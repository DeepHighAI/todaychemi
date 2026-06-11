// 60갑자 기반층 — 파생층(derive) 전용 정본 테이블.
// 기존 scoring/kasi 모듈의 중복 상수는 건드리지 않는다(백로그 Q6).

export type Stem = '甲' | '乙' | '丙' | '丁' | '戊' | '己' | '庚' | '辛' | '壬' | '癸';
export type Branch =
  | '子'
  | '丑'
  | '寅'
  | '卯'
  | '辰'
  | '巳'
  | '午'
  | '未'
  | '申'
  | '酉'
  | '戌'
  | '亥';
export type YinYang = '양' | '음';
export type Element5 = '목' | '화' | '토' | '금' | '수';

export const STEMS: readonly Stem[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
export const BRANCHES: readonly Branch[] = [
  '子',
  '丑',
  '寅',
  '卯',
  '辰',
  '巳',
  '午',
  '未',
  '申',
  '酉',
  '戌',
  '亥',
];

export interface StemInfo {
  element: Element5;
  yinyang: YinYang;
  ko: string;
}

export interface BranchInfo {
  element: Element5;
  yinyang: YinYang;
  ko: string;
  animal_ko: string;
}

// 천간 음양 = 순서 짝홀 (甲양 乙음 …) — ssaju T 테이블과 동일
export const STEM_INFO: Record<Stem, StemInfo> = {
  甲: { element: '목', yinyang: '양', ko: '갑' },
  乙: { element: '목', yinyang: '음', ko: '을' },
  丙: { element: '화', yinyang: '양', ko: '병' },
  丁: { element: '화', yinyang: '음', ko: '정' },
  戊: { element: '토', yinyang: '양', ko: '무' },
  己: { element: '토', yinyang: '음', ko: '기' },
  庚: { element: '금', yinyang: '양', ko: '경' },
  辛: { element: '금', yinyang: '음', ko: '신' },
  壬: { element: '수', yinyang: '양', ko: '임' },
  癸: { element: '수', yinyang: '음', ko: '계' },
};

// 지지 음양 = 체(體) 기준(순서 짝홀: 子양 丑음 …) — ssaju v 테이블과 동일.
// 用 기준 학파(子·巳 등 반전)도 존재하나 본 프로젝트는 체 기준 채택 (spec 명기).
export const BRANCH_INFO: Record<Branch, BranchInfo> = {
  子: { element: '수', yinyang: '양', ko: '자', animal_ko: '쥐' },
  丑: { element: '토', yinyang: '음', ko: '축', animal_ko: '소' },
  寅: { element: '목', yinyang: '양', ko: '인', animal_ko: '호랑이' },
  卯: { element: '목', yinyang: '음', ko: '묘', animal_ko: '토끼' },
  辰: { element: '토', yinyang: '양', ko: '진', animal_ko: '용' },
  巳: { element: '화', yinyang: '음', ko: '사', animal_ko: '뱀' },
  午: { element: '화', yinyang: '양', ko: '오', animal_ko: '말' },
  未: { element: '토', yinyang: '음', ko: '미', animal_ko: '양' },
  申: { element: '금', yinyang: '양', ko: '신', animal_ko: '원숭이' },
  酉: { element: '금', yinyang: '음', ko: '유', animal_ko: '닭' },
  戌: { element: '토', yinyang: '양', ko: '술', animal_ko: '개' },
  亥: { element: '수', yinyang: '음', ko: '해', animal_ko: '돼지' },
};

// 상생: A生B
export const GENERATES: Record<Element5, Element5> = {
  목: '화',
  화: '토',
  토: '금',
  금: '수',
  수: '목',
};

// 상극: A克B
export const CONTROLS: Record<Element5, Element5> = {
  목: '토',
  토: '수',
  수: '화',
  화: '금',
  금: '목',
};

// 역방향 룩업 — A를 생하는 오행 / A를 극하는 오행
export const GENERATED_BY: Record<Element5, Element5> = {
  화: '목',
  토: '화',
  금: '토',
  수: '금',
  목: '수',
};

export const CONTROLLED_BY: Record<Element5, Element5> = {
  토: '목',
  수: '토',
  화: '수',
  금: '화',
  목: '금',
};

const PILLAR_LENGTH = 2;
const SIXTY_GAPJA_COUNT = 60; // lcm(10, 12)

function isStem(ch: string): ch is Stem {
  return (STEMS as readonly string[]).includes(ch);
}

function isBranch(ch: string): ch is Branch {
  return (BRANCHES as readonly string[]).includes(ch);
}

// 한자 2글자 기둥을 천간/지지로 분해. 잘못된 입력은 throw (한글 독음은 normalizeGanji 선행 필요).
export function splitPillar(pillar: string): { stem: Stem; branch: Branch } {
  if (pillar.length !== PILLAR_LENGTH) {
    throw new Error(`Invalid pillar length: "${pillar}"`);
  }
  const stemCh = pillar[0];
  const branchCh = pillar[1];
  if (!isStem(stemCh) || !isBranch(branchCh)) {
    throw new Error(`Invalid pillar: "${pillar}"`);
  }
  return { stem: stemCh, branch: branchCh };
}

// 60갑자 — 甲子(0) … 癸亥(59)
export const SIXTY_GAPJA: readonly string[] = Object.freeze(
  Array.from(
    { length: SIXTY_GAPJA_COUNT },
    (_, i) => `${STEMS[i % STEMS.length]}${BRANCHES[i % BRANCHES.length]}`,
  ),
);

// 60갑자 인덱스 (甲子=0). 짝홀 불일치 조합(예: 甲丑)은 60갑자에 없으므로 throw.
export function gapjaIndex(pillar: string): number {
  const { stem, branch } = splitPillar(pillar);
  const idx = SIXTY_GAPJA.indexOf(`${stem}${branch}`);
  if (idx < 0) {
    throw new Error(`Not a gapja pillar: "${pillar}"`);
  }
  return idx;
}

// 한자 기둥 → 한글 독음 ('庚寅' → '경인')
export function gapjaKo(pillar: string): string {
  const { stem, branch } = splitPillar(pillar);
  return `${STEM_INFO[stem].ko}${BRANCH_INFO[branch].ko}`;
}

const KO_TO_STEM: Readonly<Record<string, Stem>> = Object.freeze(
  Object.fromEntries(STEMS.map((s) => [STEM_INFO[s].ko, s])),
);

const KO_TO_BRANCH: Readonly<Record<string, Branch>> = Object.freeze(
  Object.fromEntries(BRANCHES.map((b) => [BRANCH_INFO[b].ko, b])),
);

function resolveStem(ch: string): Stem | null {
  if (isStem(ch)) return ch;
  return KO_TO_STEM[ch] ?? null;
}

function resolveBranch(ch: string): Branch | null {
  if (isBranch(ch)) return ch;
  return KO_TO_BRANCH[ch] ?? null;
}

// 한글 독음 기둥 → 한자 ('갑자' → '甲子'). 이미 한자면 passthrough.
// 위치 기반 해석: 1글자=천간, 2글자=지지 ('신신' → '辛申').
// 앞뒤 공백은 제거 후 판정 — ' 갑자 ' 가 길이 검사에서 passthrough 돼 fail-open 강등되는 것 방지.
// 변환 불가 입력은 (trim 된) 원본 그대로 반환 (throw 금지 — splitPillar와 역할 분리).
export function normalizeGanji(pillar: string): string {
  const trimmed = pillar.trim();
  if (trimmed.length !== PILLAR_LENGTH) return trimmed;
  const stem = resolveStem(trimmed[0]);
  const branch = resolveBranch(trimmed[1]);
  if (stem === null || branch === null) return trimmed;
  return `${stem}${branch}`;
}

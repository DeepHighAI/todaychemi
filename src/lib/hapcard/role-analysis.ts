import type { ChartCore } from '@/types/chart';
import type { Mode } from '@/types/mode';
import type { RoleAnalysis, RoleAnalysisArea } from '@/types/hapcard';
import { convertHanja } from '@/lib/glossary/post-process';
import type { OhaengElement } from '@/lib/saju/elementLabel';

type StemPolarity = 'yang' | 'yin';
type Sipsin =
  | '비견'
  | '겁재'
  | '식신'
  | '상관'
  | '정재'
  | '편재'
  | '정관'
  | '편관'
  | '정인'
  | '편인';

interface StemInfo {
  element: OhaengElement;
  polarity: StemPolarity;
}

const STEMS: Record<string, StemInfo> = {
  갑: { element: '목', polarity: 'yang' },
  을: { element: '목', polarity: 'yin' },
  병: { element: '화', polarity: 'yang' },
  정: { element: '화', polarity: 'yin' },
  무: { element: '토', polarity: 'yang' },
  기: { element: '토', polarity: 'yin' },
  경: { element: '금', polarity: 'yang' },
  신: { element: '금', polarity: 'yin' },
  임: { element: '수', polarity: 'yang' },
  계: { element: '수', polarity: 'yin' },
};

const GENERATES: Record<OhaengElement, OhaengElement> = {
  목: '화',
  화: '토',
  토: '금',
  금: '수',
  수: '목',
};

const CONTROLS: Record<OhaengElement, OhaengElement> = {
  목: '토',
  토: '수',
  수: '화',
  화: '금',
  금: '목',
};

const SIPSIN_MEANING: Record<Sipsin, string> = {
  비견: '비슷한 기준을 가진 동료',
  겁재: '자원과 주도권을 나누게 하는 사람',
  식신: '편안하게 결과를 만들어내게 하는 역할',
  상관: '표현과 변화를 자극하는 역할',
  정재: '꾸준히 관리할 현실 자원',
  편재: '기회와 확장을 열어주는 자원',
  정관: '책임과 기준을 세우게 하는 역할',
  편관: '도전과 압박으로 방향을 다듬게 하는 역할',
  정인: '안정적으로 지지하고 배우게 하는 역할',
  편인: '낯선 관점으로 전환을 만드는 역할',
};

const MODE_AREA_TITLES: Record<Mode, [string, string, string]> = {
  일합: ['책임 범위', '결정 방식', '품질 점검'],
  친구합: ['편한 거리감', '대화 리듬', '오래 가는 기준'],
  돈합: ['수익 만들기', '분배 기준', '보관과 리스크'],
  첫합: ['첫인상 역할', '대화 출발점', '부담 줄이기'],
  썸합: ['끌림 표현', '속도 조절', '기대치 맞추기'],
  오래합: ['반복 패턴', '생활 역할', '장기 조율'],
};

const MODE_TIP: Record<Mode, string> = {
  일합: '회의 전에 책임자와 결정권자를 먼저 정하면 좋은 역할이 더 선명해져요.',
  친구합: '편한 관계일수록 약속 빈도와 연락 방식을 가볍게 말로 맞춰두세요.',
  돈합: '기회 탐색, 실행, 보관 역할을 나누고 분배 기준은 숫자로 남겨두세요.',
  첫합: '처음에는 상대가 편하게 느끼는 역할을 관찰하고 대화를 한 단계씩 넓혀보세요.',
  썸합: '끌림이 있어도 속도 차이가 생기기 쉬우니 표현 빈도를 먼저 맞춰보세요.',
  오래합: '익숙한 역할이 굳어지면 한 달 단위로 역할을 다시 나눠보는 게 좋아요.',
};

interface BuildRoleAnalysisInput {
  self: ChartCore;
  relation: ChartCore;
  mode: Mode;
}

function stemOf(pillar: string): string {
  const reading = convertHanja(pillar);
  return reading.charAt(0);
}

function stemInfo(pillar: string, fallbackElement: OhaengElement): StemInfo {
  return STEMS[stemOf(pillar)] ?? { element: fallbackElement, polarity: 'yang' };
}

function getSipsin(self: StemInfo, target: StemInfo): Sipsin {
  const samePolarity = self.polarity === target.polarity;

  if (self.element === target.element) return samePolarity ? '비견' : '겁재';
  if (GENERATES[self.element] === target.element) return samePolarity ? '식신' : '상관';
  if (GENERATES[target.element] === self.element) return samePolarity ? '편인' : '정인';
  if (CONTROLS[self.element] === target.element) return samePolarity ? '편재' : '정재';
  if (CONTROLS[target.element] === self.element) return samePolarity ? '편관' : '정관';

  return '비견';
}

function roleSentence(viewer: 'self' | 'relation', sipsin: Sipsin): string {
  const subject = viewer === 'self' ? '상대는 나에게' : '나는 상대에게';
  return `${subject} ${sipsin}(${SIPSIN_MEANING[sipsin]})로 작동합니다.`;
}

function areaBodies(mode: Mode, selfToRelation: Sipsin, relationToSelf: Sipsin): RoleAnalysisArea[] {
  const [a, b, c] = MODE_AREA_TITLES[mode];
  if (mode === '돈합') {
    return [
      {
        title: a,
        body: `${relationToSelf} 흐름은 돈을 만들 때 내가 맡기 쉬운 역할을 보여줍니다. 기회 탐색과 실행을 누가 맡을지 먼저 나누면 좋아요.`,
      },
      {
        title: b,
        body: `${selfToRelation} 흐름은 상대가 내게 주는 압박이나 기대를 드러냅니다. 수익·손실·재투자 기준을 숫자로 정해야 오해가 줄어듭니다.`,
      },
      {
        title: c,
        body: '장기 보관, 단기 실행, 리스크 검토를 한 사람이 모두 맡기보다 역할별로 분리하는 편이 안정적입니다.',
      },
    ];
  }

  return [
    {
      title: a,
      body: `${relationToSelf} 흐름을 보면 내가 이 관계에서 자연스럽게 맡는 역할이 보입니다. 그 역할을 억지로 넓히기보다 먼저 선명하게 잡는 편이 좋아요.`,
    },
    {
      title: b,
      body: `${selfToRelation} 흐름은 상대가 나에게 기대하거나 자극하는 지점을 보여줍니다. 기대가 커지는 영역은 말로 확인해야 부담이 줄어듭니다.`,
    },
    {
      title: c,
      body: '두 사람이 각자 편한 역할을 알고 시작하면 같은 이슈가 반복될 때 감정보다 기준으로 조정할 수 있습니다.',
    },
  ];
}

export function buildRoleAnalysis(input: BuildRoleAnalysisInput): RoleAnalysis {
  const selfStem = stemInfo(input.self.day_pillar, input.self.day_master_element);
  const relationStem = stemInfo(input.relation.day_pillar, input.relation.day_master_element);
  const relationToSelf = getSipsin(selfStem, relationStem);
  const selfToRelation = getSipsin(relationStem, selfStem);
  const selfPillar = convertHanja(input.self.day_pillar);
  const relationPillar = convertHanja(input.relation.day_pillar);

  return {
    title: `${selfPillar} ↔ ${relationPillar} 관계 유지`,
    summary: `${roleSentence('self', relationToSelf)} ${roleSentence('relation', selfToRelation)} 이 차이를 알면 역할과 기대치를 더 쉽게 나눌 수 있어요.`,
    roles: [
      {
        title: '상대가 나에게',
        sipsin: relationToSelf,
        body: `${SIPSIN_MEANING[relationToSelf]}로 느껴지기 쉬워요. 그래서 관계에서 내가 조심하거나 활용해야 할 역할이 이쪽에서 드러납니다.`,
      },
      {
        title: '내가 상대에게',
        sipsin: selfToRelation,
        body: `${SIPSIN_MEANING[selfToRelation]}로 보이기 쉬워요. 상대가 나에게 기대하는 지점도 이 역할에서 생길 수 있습니다.`,
      },
    ],
    areas: areaBodies(input.mode, selfToRelation, relationToSelf),
    basis: [
      `본인 일주 ${selfPillar}`,
      `인연 일주 ${relationPillar}`,
      `나에게 상대 ${relationToSelf}`,
      `상대에게 나 ${selfToRelation}`,
    ],
    tip: MODE_TIP[input.mode],
  };
}

export type { Sipsin };

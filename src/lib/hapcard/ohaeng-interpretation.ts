import type { ChartCore } from '@/types/chart';
import type { Mode } from '@/types/mode';
import type { OhaengInterpretation } from '@/types/hapcard';
import { convertHanja } from '@/lib/glossary/post-process';
import type { OhaengElement } from '@/lib/saju/elementLabel';

const ELEMENTS: OhaengElement[] = ['목', '화', '토', '금', '수'];

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

const ELEMENT_MEANING: Record<OhaengElement, string> = {
  목: '성장과 시작',
  화: '표현과 추진',
  토: '안정과 책임',
  금: '정리와 기준',
  수: '생각과 조율',
};

const MODE_TIPS: Record<Mode, string> = {
  일합: '역할과 결정 기준을 먼저 문서로 맞추면 같은 목표를 더 안정적으로 밀고 갈 수 있어요.',
  친구합: '서로 편한 리듬을 존중하면서 약속 빈도와 대화 방식을 가볍게 맞춰보세요.',
  돈합: '수익 목표, 분배 기준, 보관 기간을 짧게라도 문서로 남기면 오해를 줄일 수 있어요.',
  첫합: '처음부터 깊게 들어가기보다 공통 관심사 하나로 대화의 온도를 천천히 맞춰보세요.',
  썸합: '표현 속도가 다르면 한쪽이 앞서가 보일 수 있으니 답장·만남 템포를 미리 맞춰보세요.',
  오래합: '반복되는 갈등은 감정으로 풀기보다 생활 루틴과 역할 기준을 조정하는 쪽이 좋아요.',
};

interface BuildOhaengInterpretationInput {
  self: ChartCore;
  relation: ChartCore;
  mode: Mode;
}

interface ElementProfile {
  dominant: OhaengElement;
  dominantCount: number;
  missing: OhaengElement[];
}

function profileCounts(chart: ChartCore): ElementProfile {
  const counts = chart.five_elements_counts;
  let dominant = ELEMENTS[0];
  let dominantCount = counts[dominant] ?? 0;
  for (const element of ELEMENTS.slice(1)) {
    const count = counts[element] ?? 0;
    if (count > dominantCount) {
      dominant = element;
      dominantCount = count;
    }
  }
  return {
    dominant,
    dominantCount,
    missing: ELEMENTS.filter((element) => (counts[element] ?? 0) === 0),
  };
}

function formatMissing(missing: OhaengElement[]): string {
  if (missing.length === 0) return '빠지는 기운 없이 비교적 고르게 갖춰져 있습니다';
  if (missing.length === 1) return `${missing[0]} 기운이 비어 있습니다`;
  return `${missing.join('·')} 기운이 비어 있습니다`;
}

function relationSummary(selfElement: OhaengElement, relationElement: OhaengElement): string {
  if (selfElement === relationElement) {
    return `두 사람의 중심 기질이 모두 ${selfElement}라 ${ELEMENT_MEANING[selfElement]}을 보는 기준이 비슷합니다.`;
  }
  if (GENERATES[selfElement] === relationElement) {
    return `본인의 ${selfElement} 기운이 인연의 ${relationElement} 기운을 살려 주는 흐름입니다.`;
  }
  if (GENERATES[relationElement] === selfElement) {
    return `인연의 ${relationElement} 기운이 본인의 ${selfElement} 기운을 북돋는 흐름입니다.`;
  }
  if (CONTROLS[selfElement] === relationElement) {
    return `본인의 ${selfElement} 기운이 인연의 ${relationElement} 기운을 다듬는 긴장 구조입니다.`;
  }
  if (CONTROLS[relationElement] === selfElement) {
    return `인연의 ${relationElement} 기운이 본인의 ${selfElement} 기운을 조절하는 긴장 구조입니다.`;
  }
  return `두 사람의 중심 기질이 서로 다른 방향을 보완하는 흐름입니다.`;
}

function balanceBody(selfProfile: ElementProfile, relationProfile: ElementProfile): string {
  const selfMissing = formatMissing(selfProfile.missing);
  const relationMissing = formatMissing(relationProfile.missing);
  return `본인은 ${selfProfile.dominant} 기운이 가장 두드러지고 ${selfMissing}. 인연은 ${relationProfile.dominant} 기운이 가장 두드러지고 ${relationMissing}.`;
}

function flowBody(self: ChartCore, relation: ChartCore): string {
  const selfCounts = self.five_elements_counts;
  const relationCounts = relation.five_elements_counts;
  const biggestGap = ELEMENTS
    .map((element) => ({
      element,
      gap: Math.abs((selfCounts[element] ?? 0) - (relationCounts[element] ?? 0)),
    }))
    .sort((a, b) => b.gap - a.gap)[0];

  if (!biggestGap || biggestGap.gap < 2) {
    return '오행 분포 차이가 크지 않아 서로의 기준을 조금만 맞추면 비교적 평평하게 협력할 수 있습니다.';
  }

  const selfValue = selfCounts[biggestGap.element] ?? 0;
  const relationValue = relationCounts[biggestGap.element] ?? 0;
  const stronger = selfValue > relationValue ? '본인' : '인연';
  return `${biggestGap.element} 기운은 ${stronger} 쪽이 더 강합니다. ${ELEMENT_MEANING[biggestGap.element]}을 누가 주도할지 정하면 관계 흐름이 더 안정됩니다.`;
}

export function buildOhaengInterpretation(
  input: BuildOhaengInterpretationInput,
): OhaengInterpretation {
  const selfElement = input.self.day_master_element;
  const relationElement = input.relation.day_master_element;
  const selfProfile = profileCounts(input.self);
  const relationProfile = profileCounts(input.relation);
  const selfPillar = convertHanja(input.self.day_pillar);
  const relationPillar = convertHanja(input.relation.day_pillar);
  const summary = relationSummary(selfElement, relationElement);

  return {
    title: `${selfPillar} ↔ ${relationPillar} 오행 해석`,
    summary,
    points: [
      {
        label: '중심 기질',
        body: `본인은 ${selfElement}(${ELEMENT_MEANING[selfElement]}) 중심, 인연은 ${relationElement}(${ELEMENT_MEANING[relationElement]}) 중심으로 관계를 움직입니다.`,
      },
      {
        label: '균형 포인트',
        body: balanceBody(selfProfile, relationProfile),
      },
      {
        label: '관계 흐름',
        body: flowBody(input.self, input.relation),
      },
    ],
    tip: MODE_TIPS[input.mode],
  };
}

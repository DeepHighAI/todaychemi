import { describe, expect, it } from 'vitest';
import {
  formatDetailSummaryLines,
  formatHapcardActionItems,
  formatHeroCoachText,
  formatHeroMainText,
} from '@/lib/hapcard/hero-main-text';

describe('formatHeroMainText', () => {
  it('결론/강점/주의 문장을 줄바꿈으로 분리한다', () => {
    const text =
      '결론: 두 분 모두 일간이 토(흙)로 같아 업무 기준과 책임감이 비슷한 안정적 협력 기반이 형성됩니다. 강점으로는 사용자의 토 과다와 상대의 화·수 보완으로 실무 안정성과 아이디어 추진력이 서로 보완되는 흐름이 있습니다. 주의점으로는 일간이 같아 역할이 중복되기 쉬우며 세부 검수와 창의의 균형을 맞춰야 합니다.';

    expect(formatHeroMainText(text)).toBe(
      [
        '결론: 두 분 모두 일간이 토(흙)로 같아 업무 기준과 책임감이 비슷한 안정적 협력 기반이 형성됩니다.',
        '강점으로는 사용자의 토 과다와 상대의 화·수 보완으로 실무 안정성과 아이디어 추진력이 서로 보완되는 흐름이 있습니다.',
        '주의점으로는 일간이 같아 역할이 중복되기 쉬우며 세부 검수와 창의의 균형을 맞춰야 합니다.',
      ].join('\n'),
    );
  });

  it('기존 줄바꿈이 있으면 최대 3줄까지 보존한다', () => {
    expect(formatHeroMainText('결론입니다.\n강점입니다.\n주의입니다.\n네 번째입니다.')).toBe(
      '결론입니다.\n강점입니다.\n주의입니다.',
    );
  });

  it('한자 pillar가 섞이면 한글 reading으로 변환한다', () => {
    expect(formatHeroMainText('戊申과 戊午가 만납니다. 함께 안정적입니다.')).toBe(
      '무신과 무오가 만납니다.\n함께 안정적입니다.',
    );
  });
});

describe('formatHeroCoachText', () => {
  it('요약 문구 대신 좋은 점/조심할 점/해결 팁으로 구성한다', () => {
    const text = formatHeroCoachText({
      mainText:
        '결론: 두 분은 일간이 같아 첫 만남에서 편안한 동류감이 먼저 느껴지는 조합입니다. 강점: 상대가 눈에 띄게 매력적으로 느껴질 수 있습니다. 주의: 서로 비슷해서 눈치싸움이 생길 수 있습니다.',
      whyCards: [
        { title: '편한 동류감', reason: '서로 비슷해서 초반 대화가 편하게 이어집니다.' },
        { title: '감정 표현 겹침 주의', reason: '서로 비슷해서 눈치싸움이 생길 수 있습니다.' },
      ],
      actions: ['초반에는 약속을 작게 잡고 상대 반응을 천천히 확인하세요.'],
    });

    expect(text).toBe(
      [
        '"좋아!" 서로 비슷해서 초반 대화가 편하게 이어져요.',
        '"조심!" 서로 비슷해서 눈치싸움이 생길 수 있어요.',
        '"이렇게 해봐!" 초반에는 약속을 작게 잡고 상대 반응을 천천히 확인하세요.',
      ].join('\n'),
    );
  });

  it('전문 용어를 히어로용 쉬운 표현으로 바꾼다', () => {
    const text = formatHeroCoachText({
      mainText: '결론: 안정적입니다.',
      whyCards: [
        { title: '비슷한 성향', reason: '정관(책임·규칙을 다루는 기운) 성향이 뚜렷해 신뢰를 줍니다.' },
        { title: '시지 주의', reason: '시지(시간 기둥) 정보가 없어 세부 타이밍 조율은 불확실합니다.' },
      ],
      actions: ['역할을 먼저 나눠보세요.'],
    });

    expect(text).toContain('"좋아!" 책임감과 기준 성향이 뚜렷해 신뢰를 줘요.');
    expect(text).toContain('"조심!" 태어난 시간 정보가 없어 세부 타이밍 조율은 불확실해요.');
  });

  it('천간이 붙은 일간 표현도 어색하게 붙지 않도록 풀어쓴다', () => {
    const text = formatHeroCoachText({
      mainText: '결론: 편안합니다.',
      whyCards: [
        { title: '편안함', reason: '같은 무일간과 토 기운으로 첫 대화부터 편안하게 호흡이 맞고 상대의 매력도 금방 눈에 띔.' },
        { title: '속도 주의', reason: '토 중심의 안정적 에너지라 급하게 밀어붙이면 부담될 수 있습니다.' },
      ],
      actions: ['공통 관심사 하나를 먼저 꺼내보세요.'],
    });

    expect(text).toContain('같은 타고난 중심 기질과 차분하고 안정적인 성향으로');
    expect(text).toContain('안정감을 중시하는 성향이라 급하게 밀어붙이면 부담될 수 있어요.');
    expect(text).not.toContain('무타고난');
  });

  it('저장된 문구에 actions[0] 표기가 섞여도 히어로에 노출하지 않고 어미를 자연스럽게 정리한다', () => {
    const text = formatHeroCoachText({
      mainText: '결론: 편안합니다.',
      whyCards: [
        { title: '끌림', reason: '상대가 먼저 다가오는 흐름이 뚜렷합니다.' },
        { title: '페이스 차이 조심', reason: 'actions[0]처럼 내 페이스로 한 번씩 리드하면 도움이 된다.' },
      ],
      actions: ['상대의 먼저 다가오는 표현을 편하게 받아들이되 내 페이스로 한 번씩 리드해보자'],
    });

    expect(text).not.toContain('actions[0]');
    expect(text).toContain('"조심!" 내 페이스로 한 번씩 리드하면 도움이 돼요.');
    expect(text).toContain('"이렇게 해봐!" 상대의 먼저 다가오는 표현을 편하게 받아들이되 내 페이스로 한 번씩 리드해보자.');
  });
});

describe('formatDetailSummaryLines', () => {
  it('결론/강점/주의 라벨과 본문을 분리한다', () => {
    const lines = formatDetailSummaryLines(
      '결론: 함께 일할 때 기준이 비슷합니다. 강점으로는 안정적인 실행과 빠른 아이디어가 서로 보완됩니다. 주의점으로는 역할이 겹치지 않게 나누는 약속이 필요합니다.',
    );

    expect(lines).toEqual([
      { key: 'conclusion', label: '결론', body: '함께 일할 때 기준이 비슷합니다.' },
      { key: 'strength', label: '강점', body: '안정적인 실행과 빠른 아이디어가 서로 보완됩니다.' },
      { key: 'caution', label: '주의', body: '역할이 겹치지 않게 나누는 약속이 필요합니다.' },
    ]);
  });
});

describe('formatHapcardActionItems', () => {
  it('4개 actions가 있으면 actions[0]은 히어로용으로 제외하고 actions[1~3]만 카드에 쓴다', () => {
    const items = formatHapcardActionItems({
      mainText: '결론: 편안합니다. 강점: 매력이 잘 보입니다. 주의: 속도 차이가 생길 수 있습니다.',
      actions: ['히어로 대표 팁', '카드 행동 1', '카드 행동 2', '카드 행동 3'],
      whyCards: [],
    });

    expect(items).toEqual(['카드 행동 1.', '카드 행동 2.', '카드 행동 3.']);
    expect(items).not.toContain('히어로 대표 팁.');
  });

  it('기존 3개 actions에서 첫 카드가 히어로와 중복되면 구체 실행 문장으로 바꾼다', () => {
    const items = formatHapcardActionItems({
      mainText:
        '결론: 상대가 먼저 끌리는 쪽입니다. 강점: 설렘이 빠르게 드러납니다. 주의: 서로 느끼는 속도 차이가 생길 수 있습니다.',
      whyCards: [
        { title: '상대 쪽에서 먼저 끌림이 옴', reason: '상대가 먼저 다가오는 흐름이 뚜렷합니다.' },
        { title: '페이스 차이 조심', reason: '상대의 빠른 감정 흐름에 내 속도가 밀릴 수 있습니다.' },
      ],
      actions: [
        '상대의 먼저 다가오는 표현을 편하게 받아들이되 내 페이스로 한 번씩 리드해보자',
        '상대가 감정 표현이 빠를 때는 내 기준을 짧고 솔직하게 알려 페이스 차이를 줄여보자',
        '차분한 대화 자리에서 서로의 기대치를 한두 마디로 맞춰보자',
      ],
    });

    expect(items[0]).toBe(
      '상대가 먼저 다가오면 바로 맞추려 하기보다, 연락 빈도나 만나는 속도를 한 문장으로 정해보세요.',
    );
    expect(items[0]).not.toBe(
      '상대의 먼저 다가오는 표현을 편하게 받아들이되 내 페이스로 한 번씩 리드해보자.',
    );
    expect(items).toHaveLength(3);
  });
});

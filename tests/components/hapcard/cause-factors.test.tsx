// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { HapcardCauseFactors } from '@/components/hapcard/cause-factors';

const FACTORS = [
  { name: '대화 흐름', effect: '말의 온도가 안정적이에요.' },
  { name: '속도 차이', effect: '서로 리듬이 조금 달라요.' },
  { name: '신뢰 기반', effect: '약속을 지키면 빠르게 단단해져요.' },
];

describe('HapcardCauseFactors', () => {
  it('명리 근거 3항목의 name과 effect를 렌더한다', () => {
    renderWithProviders(<HapcardCauseFactors factors={FACTORS} />);

    expect(screen.getByTestId('hapcard-cause-factors')).toBeInTheDocument();
    for (const factor of FACTORS) {
      expect(screen.getByText(factor.name)).toBeInTheDocument();
      expect(screen.getByText(factor.effect)).toBeInTheDocument();
    }
  });

  it('ADR-038: name·effect의 한자를 convertHanja로 한글 변환해 노출 차단한다', () => {
    renderWithProviders(
      <HapcardCauseFactors factors={[{ name: '比肩 기운', effect: '正官 작용이 강해요(安定).' }]} />,
    );

    expect(screen.getByText('비견 기운')).toBeInTheDocument();
    expect(screen.getByText('정관 작용이 강해요.')).toBeInTheDocument();
    // CJK 한자가 DOM 텍스트에 남지 않는다
    const root = screen.getByTestId('hapcard-cause-factors');
    expect(root.textContent ?? '').not.toMatch(/[一-鿿]/);
  });

  it('factors가 비면 안내 문구를 보여준다', () => {
    renderWithProviders(<HapcardCauseFactors factors={[]} />);
    expect(screen.getByText(/아직 준비되지/)).toBeInTheDocument();
  });
});

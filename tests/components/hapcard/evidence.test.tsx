// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { HapcardEvidence } from '@/components/hapcard/evidence';

describe('HapcardEvidence', () => {
  it('data-testid="hapcard-evidence" 렌더', () => {
    renderWithProviders(<HapcardEvidence cards={[]} />);
    expect(document.querySelector('[data-testid="hapcard-evidence"]')).not.toBeNull();
  });

  it('빈 배열 → empty 카피 표시', () => {
    renderWithProviders(<HapcardEvidence cards={[]} />);
    expect(screen.getByText('근거가 아직 준비되지 않았어요.')).toBeInTheDocument();
  });

  it('카드 2개 → title/reason 모두 표시', () => {
    const cards = [
      { title: '오행 조화', reason: '목과 화가 잘 맞아요.' },
      { title: '사주 상생', reason: '갑인과 병오는 상생 관계.' },
    ];
    renderWithProviders(<HapcardEvidence cards={cards} />);
    expect(screen.getByText('오행 조화')).toBeInTheDocument();
    expect(screen.getByText('목과 화가 잘 맞아요.')).toBeInTheDocument();
    expect(screen.getByText('사주 상생')).toBeInTheDocument();
    expect(screen.getByText('갑인과 병오는 상생 관계.')).toBeInTheDocument();
  });
});

describe('HapcardEvidence + GlossaryProvider 통합', () => {
  it('등록 용어 "일주"가 title에 있으면 TermTooltip trigger 렌더', () => {
    const cards = [{ title: '일주 분석', reason: '상생 에너지.' }];
    renderWithProviders(<HapcardEvidence cards={cards} />);
    expect(screen.getByTestId('term-tooltip-trigger')).toBeInTheDocument();
  });

  it('첫 등장 용어 → 정의 텍스트 자동 노출 (defaultOpen=true)', () => {
    const cards = [{ title: '일주 분석', reason: '상생 에너지.' }];
    renderWithProviders(<HapcardEvidence cards={cards} />);
    expect(screen.getByText(/태어난 날의 천간/)).toBeInTheDocument();
  });

  it('같은 용어 두 번 등장 → trigger 2개, 정의 텍스트는 1회만 노출', () => {
    const cards = [
      { title: '일주 특성', reason: '일주가 강함.' },
    ];
    renderWithProviders(<HapcardEvidence cards={cards} />);
    const triggers = screen.getAllByTestId('term-tooltip-trigger');
    expect(triggers).toHaveLength(2);
    expect(screen.getAllByText(/태어난 날의 천간/)).toHaveLength(1);
  });

  it('미등록 용어 "썸합"은 plain text 유지, trigger 없음', () => {
    const cards = [{ title: '썸합 분석', reason: '편안한 관계.' }];
    renderWithProviders(<HapcardEvidence cards={cards} />);
    expect(screen.queryByTestId('term-tooltip-trigger')).toBeNull();
    expect(screen.getByText(/썸합/)).toBeInTheDocument();
  });
});

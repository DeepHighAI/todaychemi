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

  it('소프트 용어 "끌림" → trigger 렌더 (classical 키 합으로 조회)', () => {
    const cards = [{ title: '두 사람의 끌림이 강합니다', reason: '기운이 맞아요.' }];
    renderWithProviders(<HapcardEvidence cards={cards} />);
    expect(screen.getByTestId('term-tooltip-trigger')).toBeInTheDocument();
  });

  it('소프트 용어 "긴장"과 "부딪힘" → trigger 2개 렌더', () => {
    const cards = [{ title: '긴장과 부딪힘이 동시에', reason: '조율이 필요해요.' }];
    renderWithProviders(<HapcardEvidence cards={cards} />);
    expect(screen.getAllByTestId('term-tooltip-trigger')).toHaveLength(2);
  });

  it('"썸합 + 끌림" → 끌림만 trigger, 썸합은 plain text', () => {
    const cards = [{ title: '썸합 + 끌림 분석', reason: '끌림이 있어요.' }];
    renderWithProviders(<HapcardEvidence cards={cards} />);
    const triggers = screen.getAllByTestId('term-tooltip-trigger');
    expect(triggers).toHaveLength(2);
  });

  it('compound 용어 "자오충"이 title에 있으면 단일 TermTooltip trigger 렌더 (분해 안 됨)', () => {
    const cards = [{ title: '자오충 관계로 강한 부딪힘', reason: '지지가 정반대입니다.' }];
    renderWithProviders(<HapcardEvidence cards={cards} />);
    // 자오충(compound) + 부딪힘(soft alias) = trigger 2개
    const triggers = screen.getAllByTestId('term-tooltip-trigger');
    expect(triggers).toHaveLength(2);
    // 첫 번째 trigger가 자오충을 단일 unit으로 감싸고 있어야 함
    expect(triggers[0]).toHaveTextContent('자오충');
  });

  it('"인오술 삼합" → 삼합과 인오술이 각각 단일 trigger', () => {
    const cards = [{ title: '인오술 삼합 에너지', reason: '화기(火氣)가 강합니다.' }];
    renderWithProviders(<HapcardEvidence cards={cards} />);
    const triggers = screen.getAllByTestId('term-tooltip-trigger');
    // 인오술(compound) + 삼합(compound) = 2개
    expect(triggers).toHaveLength(2);
  });

  it('"자오충" definition 텍스트가 tooltip에 표시된다 (defaultOpen=true 첫 등장)', () => {
    const cards = [{ title: '자오충 관계', reason: '에너지가 맞부딪힙니다.' }];
    renderWithProviders(<HapcardEvidence cards={cards} />);
    // 자오충 definition 텍스트 일부 확인
    expect(screen.getByText(/정반대 방향으로 부딪히는/)).toBeInTheDocument();
  });
});

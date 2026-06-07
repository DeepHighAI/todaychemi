// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { TodayHero } from '@/components/today/today-hero';
import type { DailyHapCard } from '@/types/dailyHap';

const card: DailyHapCard = {
  headline: '좋은 에너지가 흐르는 날',
  headline_reason: '목기운이 강해 창의력이 높아요',
  avoid_phrase: '비난하는 말',
  avoid_phrase_reason: '갈등을 유발할 수 있어요',
  favorable_action: '새로운 시도',
  favorable_action_reason: '화기운이 도와줘요',
  reused_from_yesterday: false,
};

describe('TodayHero', () => {
  it('headline 텍스트를 렌더한다', () => {
    renderWithProviders(<TodayHero card={card} />);
    expect(screen.getByText('좋은 에너지가 흐르는 날')).toBeInTheDocument();
  });

  it('headline_reason 텍스트를 렌더한다', () => {
    renderWithProviders(<TodayHero card={card} />);
    expect(screen.getByText('목기운이 강해 창의력이 높아요')).toBeInTheDocument();
  });

  it('wrapper에 bg-liquid-hero 클래스가 있다', () => {
    const { container } = renderWithProviders(<TodayHero card={card} />);
    expect(container.querySelector('.bg-liquid-hero')).toBeInTheDocument();
  });

  it('reused_from_yesterday=true면 "어제 이어감" 칩을 렌더한다', () => {
    renderWithProviders(<TodayHero card={{ ...card, reused_from_yesterday: true }} />);
    expect(screen.getByText('어제 이어감')).toBeInTheDocument();
  });

  it('reused_from_yesterday=false면 칩을 렌더하지 않는다', () => {
    renderWithProviders(<TodayHero card={card} />);
    expect(screen.queryByText('어제 이어감')).toBeNull();
  });

  it('fallback card 면 "기본 안내" 칩을 렌더하고 점수 대신 fallback headline을 보여준다', () => {
    renderWithProviders(
      <TodayHero
        card={{
          ...card,
          headline: '오늘은 천천히 확인해요',
          relation_id: 'rel-1',
          relation_nickname: '민지',
          today_compat_score: 78,
          is_fallback: true,
        } as DailyHapCard & { is_fallback: true }}
      />,
    );

    expect(screen.getByText('기본 안내')).toBeInTheDocument();
    expect(screen.getByText('오늘은 천천히 확인해요')).toBeInTheDocument();
    expect(screen.queryByText('38.4')).toBeNull();
  });

  it('headline의 한자(漢字)를 한글로 변환한다 (ADR-038)', () => {
    renderWithProviders(<TodayHero card={{ ...card, headline: '日主 火의 흐름' }} />);
    expect(screen.getByText('일주 화의 흐름')).toBeInTheDocument();
  });

  it('headline_reason의 한자를 한글로 변환한다 (ADR-038)', () => {
    renderWithProviders(<TodayHero card={{ ...card, headline_reason: '酉金이 火를 누르는 흐름' }} />);
    expect(screen.getByText('유금이 화를 누르는 흐름')).toBeInTheDocument();
  });

  it('score가 있으면 100점 만점 대신 케미온도 °C로 렌더한다', () => {
    renderWithProviders(<TodayHero card={card} score={62} deltaVsYesterday={15} />);
    expect(screen.getByText('37.6')).toBeInTheDocument();
    expect(screen.getByText('°C')).toBeInTheDocument();
    expect(screen.getByText(/▲ \+0\.8°C vs 어제/)).toBeInTheDocument();
    expect(screen.queryByText('/100')).toBeNull();
  });

  // G2 / Phase 3 C8 — 인연 chip + 케미온도 노출
  describe('G2 — 인연 종합 (relation_id + relation_nickname + today_compat_score)', () => {
    it('relation_nickname 있으면 hero 안에 별명 chip 렌더', () => {
      renderWithProviders(
        <TodayHero
          card={{
            ...card,
            relation_id: 'rel-1',
            relation_nickname: '민지',
            today_compat_score: 78,
          }}
        />,
      );
      // chip 안에 별명 노출
      expect(screen.getByText(/민지/)).toBeInTheDocument();
    });

    it('today_compat_score 있으면 그 점수를 케미온도로 사용 (compat_score보다 우선)', () => {
      renderWithProviders(
        <TodayHero
          card={{
            ...card,
            relation_id: 'rel-1',
            relation_nickname: '민지',
            today_compat_score: 78,
          }}
          score={20}
        />,
      );
      // today_compat_score=78 → 37.0 + (78-50)/20 = 38.4°C
      expect(screen.getByText('38.4')).toBeInTheDocument();
      // score=20 → 37.0 + (20-50)/20 = 35.5°C (clamp min). 미사용 확인.
      expect(screen.queryByText('35.5')).toBeNull();
    });

    it('relation_id 없으면 chip 미렌더', () => {
      renderWithProviders(<TodayHero card={card} />);
      // 일반 hero — 별명 자리에 별명 없음
      expect(screen.queryByText('민지')).toBeNull();
    });

    it('relation_id 없을 때 "인연 등록하고 오늘 케미 보기" CTA 노출 (인연 0건 사용자 유도)', () => {
      renderWithProviders(<TodayHero card={card} />);
      // i18n key home.empty_relation.cta 노출
      expect(screen.getByText(/인연 등록.*오늘 케미/)).toBeInTheDocument();
    });

    it('relation_id 있을 때 "인연 등록하고 오늘 케미 보기" CTA 미노출', () => {
      renderWithProviders(
        <TodayHero
          card={{
            ...card,
            relation_id: 'rel-1',
            relation_nickname: '민지',
            today_compat_score: 78,
          }}
        />,
      );
      expect(screen.queryByText(/인연 등록.*오늘 케미/)).toBeNull();
    });

    // F2.2: Link 중첩 해제 — chip 자리는 인터랙티브 영역으로 분리되어야 함
    it('F2.2: 별명 chip은 outer Link(<a>) 안에 중첩되지 않는다', () => {
      renderWithProviders(
        <TodayHero
          card={{
            ...card,
            relation_id: 'rel-1',
            relation_nickname: '민지',
            today_compat_score: 78,
          }}
        />,
      );
      // 별명 텍스트가 <a> 자손이면 RelationChip 클릭이 navigate 로 흡수됨
      const chipText = screen.getByText(/민지/);
      const closestAnchor = chipText.closest('a');
      expect(closestAnchor).toBeNull();
    });
  });
});

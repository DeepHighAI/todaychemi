// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithIntl } from '../../utils/render-with-intl';

import { GuestTodayMeView } from '@/components/today/guest-today-me-view';
import type { GuestTodaySnapshot } from '@/lib/guest/session';

const SNAPSHOT: GuestTodaySnapshot = {
  onboarding: {
    nickname: '하늘달',
    birth_date: '1995-11-05',
    birth_date_calendar: 'solar',
    is_lunar_leap: false,
    birth_time_knowledge: 'exact',
    birth_time: '14:20',
    gender: 'M',
  },
  card: {
    headline: '오늘은 정리하기 좋아요.',
    headline_reason: '차분하게 정리할수록 흐름이 선명해져요.',
    avoid_phrase: '급한 말',
    avoid_phrase_reason: '서두른 표현은 오해를 만들 수 있어요.',
    favorable_action: '작게 정리하기',
    favorable_action_reason: '작은 정리가 다음 선택을 가볍게 해요.',
    reused_from_yesterday: false,
    compat_score: null,
    headline_strength: null,
  },
  chart: {
    year_pillar: '갑자',
    month_pillar: '을축',
    day_pillar: '병인',
    hour_pillar: null,
    day_master_element: '화',
    five_elements_counts: { 목: 2, 화: 1, 토: 0, 금: 0, 수: 1 },
    gender_normalized: 'M',
    yunse: {
      daeun: { start_age: 7, list: [{ age: 7, pillar: '갑자', year: 2002 }], current_index: 0 },
      seyun: { current_pillar: '병오', current_year: 2026 },
      wolun: { current_pillar: '계사', current_month: '2026-05' },
      iliun: { today_pillar: '갑자', today_date: '2026-05-26' },
    },
  },
  generatedAt: '2026-05-26T12:00:00.000+09:00',
};

describe('GuestTodayMeView', () => {
  it('renders the guest today result and signup CTA', () => {
    renderWithIntl(<GuestTodayMeView snapshot={SNAPSHOT} />);

    expect(screen.getByText('하늘달님의 오늘을 먼저 볼게요.')).toBeInTheDocument();
    expect(screen.getAllByText('오늘 나의 흐름').length).toBeGreaterThan(0);
    expect(screen.getByText('오늘은 정리하기 좋아요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '친구와의 오늘 우리는 보기' })).toHaveAttribute(
      'href',
      '/signup?intent=guest',
    );
  });
});

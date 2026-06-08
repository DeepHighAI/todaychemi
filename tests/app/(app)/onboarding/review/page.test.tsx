// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithIntl } from '../../../../utils/render-with-intl';
import OnboardingReviewPage from '@/app/(app)/onboarding/review/page';

// review 페이지는 useRouter() 만 네비게이션에서 사용 (제출 시 push)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

describe('OnboardingReviewPage — AI 생성 고지 (1G)', () => {
  it('온보딩 마지막(검토) 단계에 AI 생성 고지 notice 를 렌더한다 (최초 1회)', () => {
    renderWithIntl(<OnboardingReviewPage />);
    expect(screen.getByTestId('ai-disclosure-notice')).toBeInTheDocument();
    expect(screen.getByText('AI가 만든 해석이에요')).toBeInTheDocument();
  });
});

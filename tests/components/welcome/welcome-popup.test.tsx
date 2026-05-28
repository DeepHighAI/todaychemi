// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithIntl } from '../../utils/render-with-intl';

const STORAGE_KEY = 'welcome_popup_seen_v1';

describe('WelcomePopup', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('첫 진입 (seen=null) 시 오늘사이 소개 카피와 시작하기 버튼이 노출된다', async () => {
    const { WelcomePopup } = await import('@/components/welcome/welcome-popup');
    renderWithIntl(<WelcomePopup />);
    await waitFor(() => {
      expect(screen.getByText('오늘사이')).toBeInTheDocument();
    });
    expect(
      screen.getByText(/오늘 만나는 누군가와의 관계에 도움을 주기 위한 서비스입니다/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '시작하기' })).toBeInTheDocument();
  });

  it('이미 본 사용자 (seen=1) 는 팝업이 렌더되지 않는다', async () => {
    window.localStorage.setItem(STORAGE_KEY, '1');
    const { WelcomePopup } = await import('@/components/welcome/welcome-popup');
    renderWithIntl(<WelcomePopup />);
    // 첫 effect 이후에도 노출되면 안 됨
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText('오늘사이')).not.toBeInTheDocument();
  });

  it('시작하기 버튼 클릭 시 localStorage 에 seen=1 이 기록된다', async () => {
    const { WelcomePopup } = await import('@/components/welcome/welcome-popup');
    renderWithIntl(<WelcomePopup />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '시작하기' })).toBeInTheDocument();
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '시작하기' }));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('1');
  });

  it('CTA 문구 "누군가와의 오늘을 미리 보세요" 가 노출된다', async () => {
    const { WelcomePopup } = await import('@/components/welcome/welcome-popup');
    renderWithIntl(<WelcomePopup />);
    await waitFor(() => {
      expect(screen.getByText('누군가와의 오늘을 미리 보세요')).toBeInTheDocument();
    });
  });

  it('localStorage 접근 실패해도 throw 하지 않는다 (private mode 대비)', async () => {
    const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
    window.localStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    try {
      const { WelcomePopup } = await import('@/components/welcome/welcome-popup');
      renderWithIntl(<WelcomePopup />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '시작하기' })).toBeInTheDocument();
      });
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: '시작하기' }));
      // 예외 없이 통과해야 함
      expect(true).toBe(true);
    } finally {
      window.localStorage.setItem = originalSetItem;
    }
  });
});

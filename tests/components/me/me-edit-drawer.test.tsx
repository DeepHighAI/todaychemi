// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { MeEditDrawer } from '@/components/me/me-edit-drawer';

const MOCK_PROFILE = {
  nickname: '하늘달',
  birth_date: '1991-03-15',
  birth_date_calendar: 'solar',
  is_lunar_leap: false,
  birth_time_knowledge: 'exact',
  birth_time: '14:30',
  gender: 'F',
};

function mockFetch(opts: { getOk?: boolean; patchOk?: boolean } = {}) {
  const { getOk = true, patchOk = true } = opts;
  global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url === '/api/me' && method === 'GET') {
      return Promise.resolve(
        new Response(JSON.stringify(getOk ? { ok: true, profile: MOCK_PROFILE } : { error: { code: 'NOT_ONBOARDED' } }), {
          status: getOk ? 200 : 404,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }
    if (url === '/api/me' && method === 'PATCH') {
      return Promise.resolve(
        new Response(JSON.stringify(patchOk ? { ok: true } : { error: { code: 'INTERNAL_ERROR' } }), {
          status: patchOk ? 200 : 500,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }
    return Promise.resolve(new Response('{}', { status: 200 }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MeEditDrawer', () => {
  it('open=true 일 때 GET /api/me 호출 후 별명 입력 필드 pre-fill 됨', async () => {
    mockFetch();
    renderWithProviders(<MeEditDrawer open={true} onOpenChange={vi.fn()} />);
    await waitFor(() => {
      const input = screen.getByLabelText(/별명/i) as HTMLInputElement;
      expect(input.value).toBe('하늘달');
    });
  });

  it('별명 비워놓으면 저장 버튼 disabled', async () => {
    mockFetch();
    renderWithProviders(<MeEditDrawer open={true} onOpenChange={vi.fn()} />);
    await waitFor(() => {
      const input = screen.getByLabelText(/별명/i);
      expect(input).toBeInTheDocument();
    });
    const input = screen.getByLabelText(/별명/i);
    fireEvent.change(input, { target: { value: '' } });
    const saveBtn = screen.getByRole('button', { name: /저장/ });
    expect(saveBtn).toBeDisabled();
  });

  it('생년월일 picker를 drawer 안에서 터치해 날짜를 변경할 수 있다', async () => {
    mockFetch();
    renderWithProviders(<MeEditDrawer open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /생년월일.*1991년 3월 15일/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /생년월일.*1991년 3월 15일/ }));
    expect(document.querySelector('.tray.on')).toBeTruthy();

    const day20 = Array.from(document.querySelectorAll('.cal .d:not(.muted)'))
      .find((el) => el.textContent === '20') as HTMLElement;
    fireEvent.click(day20);

    expect(screen.getByRole('button', { name: /생년월일.*1991년 3월 20일/ })).toBeInTheDocument();
  });

  it('시간 picker를 drawer 안에서 터치해 시간을 변경할 수 있다', async () => {
    mockFetch();
    renderWithProviders(<MeEditDrawer open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /시간 입력.*14:30/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /시간 입력.*14:30/ }));
    expect(document.querySelector('.tray.on')).toBeTruthy();

    const hour09 = Array.from(document.querySelectorAll('.picker-col')[0].querySelectorAll('.opt'))
      .find((el) => el.textContent === '09') as HTMLElement;
    fireEvent.click(hour09);

    const min00 = Array.from(document.querySelectorAll('.picker-col')[1].querySelectorAll('.opt'))
      .find((el) => el.textContent === '00') as HTMLElement;
    fireEvent.click(min00);
    fireEvent.click(screen.getByText('완료'));

    expect(screen.getByRole('button', { name: /시간 입력.*09:00/ })).toBeInTheDocument();
  });

  it('저장 성공 → onOpenChange(false) 호출', async () => {
    mockFetch({ patchOk: true });
    const onOpenChange = vi.fn();
    renderWithProviders(<MeEditDrawer open={true} onOpenChange={onOpenChange} />);
    // 프로필 pre-fill 대기
    await waitFor(() => {
      const input = screen.getByLabelText(/별명/i) as HTMLInputElement;
      expect(input.value).toBe('하늘달');
    });
    const saveBtn = screen.getByRole('button', { name: /저장/ });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('저장 실패 → error 메시지 노출 + drawer 유지', async () => {
    mockFetch({ patchOk: false });
    const onOpenChange = vi.fn();
    renderWithProviders(<MeEditDrawer open={true} onOpenChange={onOpenChange} />);
    // 프로필 pre-fill 대기
    await waitFor(() => {
      const input = screen.getByLabelText(/별명/i) as HTMLInputElement;
      expect(input.value).toBe('하늘달');
    });
    const saveBtn = screen.getByRole('button', { name: /저장/ });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

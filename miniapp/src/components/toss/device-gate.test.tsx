import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

import { renderWithProviders } from '@/test/render';

const sdk = vi.hoisted(() => ({
  getDeviceId: vi.fn(() => 'device-abc'),
}));

vi.mock('@apps-in-toss/web-framework', () => ({
  getDeviceId: sdk.getDeviceId,
}));

vi.mock('@/lib/api/client');
vi.mock('@/lib/auth/AuthProvider');

import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { TossDeviceGate } from './device-gate';

const authed = { token: 'tok', isAuthed: true, isLoading: false, login: vi.fn(), logout: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  sdk.getDeviceId.mockReturnValue('device-abc');
  vi.mocked(useAuth).mockReturnValue(authed as never);
  vi.mocked(apiFetch).mockResolvedValue({ ok: true } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TossDeviceGate', () => {
  it('인증 완료 후 getDeviceId 값을 서버에 제출한다', async () => {
    renderWithProviders(<TossDeviceGate />);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/toss/device', {
        method: 'POST',
        token: 'tok',
        body: { deviceId: 'device-abc' },
      });
    });
  });

  it('비인증 상태에서는 SDK 와 API 를 호출하지 않는다', () => {
    vi.mocked(useAuth).mockReturnValue({ ...authed, token: null, isAuthed: false } as never);

    renderWithProviders(<TossDeviceGate />);

    expect(sdk.getDeviceId).not.toHaveBeenCalled();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('getDeviceId 실패는 UX 를 막지 않고 API 호출도 하지 않는다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    sdk.getDeviceId.mockImplementation(() => {
      throw new Error('sdk unavailable');
    });

    renderWithProviders(<TossDeviceGate />);

    expect(apiFetch).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('[toss-device] getDeviceId failed', {
      message: 'sdk unavailable',
    });
  });
});

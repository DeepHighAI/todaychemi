import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// @apps-in-toss/web-framework — appLogin / Storage / getOperationalEnvironment 사용.
vi.mock('@apps-in-toss/web-framework', () => ({
  appLogin: vi.fn(),
  Storage: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
  getOperationalEnvironment: vi.fn(),
}));

import { appLogin, Storage, getOperationalEnvironment } from '@apps-in-toss/web-framework';
import { AuthProvider, useAuth } from './AuthProvider';

const mockAppLogin = vi.mocked(appLogin);
const mockStorageGet = vi.mocked(Storage.getItem);
const mockEnv = vi.mocked(getOperationalEnvironment);

function Probe() {
  const { token, isLoading } = useAuth();
  if (isLoading) return <span>loading</span>;
  return <span>token:{token ?? 'none'}</span>;
}

/**
 * 네이티브 환경 시뮬레이션. `getOperationalEnvironment()` 반환값으로 토스/샌드박스를 흉내내고,
 * 비네이티브(브라우저 dev)는 SDK 브릿지 부재로 throw 하는 동작을 재현한다.
 */
function setNative(env: 'toss' | 'sandbox' | false) {
  if (env) mockEnv.mockReturnValue(env);
  else mockEnv.mockImplementation(() => {
    throw new Error('getOperationalEnvironment is not a constant handler');
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // dev-bearer 분기 회피 — 실제 appLogin 경로를 검증.
  vi.stubEnv('VITE_DEV_BEARER', '');
  mockStorageGet.mockResolvedValue(null);
  setNative(false);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('AuthProvider — 자동 로그인', () => {
  it('네이티브 환경 + 저장 토큰 없음 → appLogin 으로 자동 로그인하고 토큰을 노출한다', async () => {
    setNative('toss');
    mockAppLogin.mockResolvedValue({ authorizationCode: 'code', referrer: 'ref' } as never);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: 'tok-123' }) }),
    );

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(await screen.findByText('token:tok-123')).toBeInTheDocument();
    expect(mockAppLogin).toHaveBeenCalledTimes(1);
  });

  it('샌드박스 환경 + 저장 토큰 없음 → appLogin 으로 자동 로그인한다', async () => {
    setNative('sandbox');
    mockAppLogin.mockResolvedValue({ authorizationCode: 'code', referrer: 'SANDBOX' } as never);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: 'tok-sbx' }) }),
    );

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(await screen.findByText('token:tok-sbx')).toBeInTheDocument();
    expect(mockAppLogin).toHaveBeenCalledTimes(1);
  });

  it('appLogin 실패 → 재시도 게이트(AuthRetryGate) 를 렌더한다', async () => {
    setNative('toss');
    mockAppLogin.mockRejectedValue(new Error('appLogin failed'));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(await screen.findByText('로그인에 실패했어요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });

  it('비-네이티브(웹 프리뷰) → appLogin 미발화, 자식 렌더', async () => {
    setNative(false);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(await screen.findByText('token:none')).toBeInTheDocument();
    expect(mockAppLogin).not.toHaveBeenCalled();
  });
});

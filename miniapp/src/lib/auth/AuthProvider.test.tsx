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
import { triggerReauth, __resetReauthForTest } from './reauth';

const mockAppLogin = vi.mocked(appLogin);
const mockStorageGet = vi.mocked(Storage.getItem);
const mockEnv = vi.mocked(getOperationalEnvironment);

/** 테스트용 최소 JWT (exp 초 단위). */
function makeJwt(expSec: number): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256' })}.${b64({ exp: expSec })}.sig`;
}
const nowSec = () => Math.floor(Date.now() / 1000);

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
  // 실패 진단 로그를 조용히 캡처(콘솔 노이즈 방지 + 호출 단언).
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  __resetReauthForTest();
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
    // 실패 원인을 게이트에 보조 노출 + 콘솔에 기록(삼키지 않음).
    expect(await screen.findByText('원인: appLogin failed')).toBeInTheDocument();
    expect(console.error).toHaveBeenCalled();
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

  it('만료된 저장 토큰 → 폐기하고 재로그인(appLogin)으로 새 토큰 획득', async () => {
    setNative('toss');
    mockStorageGet.mockResolvedValue(makeJwt(nowSec() - 100)); // 만료
    mockAppLogin.mockResolvedValue({ authorizationCode: 'code', referrer: 'ref' } as never);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: 'tok-new' }) }),
    );

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(await screen.findByText('token:tok-new')).toBeInTheDocument();
    expect(mockAppLogin).toHaveBeenCalledTimes(1);
  });

  it('유효한 저장 토큰 → 복원만 하고 재로그인 안 함', async () => {
    setNative('toss');
    const valid = makeJwt(nowSec() + 3600);
    mockStorageGet.mockResolvedValue(valid);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(await screen.findByText(`token:${valid}`)).toBeInTheDocument();
    expect(mockAppLogin).not.toHaveBeenCalled();
  });

  it('마운트 시 재인증 핸들러 등록 → triggerReauth 가 재로그인으로 새 토큰을 반환', async () => {
    setNative('toss');
    const valid = makeJwt(nowSec() + 3600);
    mockStorageGet.mockResolvedValue(valid); // 부트스트랩은 재로그인 안 함(유효 토큰)
    mockAppLogin.mockResolvedValue({ authorizationCode: 'c', referrer: 'r' } as never);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: 'reauth-tok' }) }),
    );

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await screen.findByText(`token:${valid}`); // 마운트 완료

    // apiFetch 가 401 에서 호출하는 경로를 직접 트리거
    const fresh = await triggerReauth();
    expect(fresh).toBe('reauth-tok');
    expect(mockAppLogin).toHaveBeenCalledTimes(1);
  });
});

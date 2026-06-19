import { afterEach, describe, expect, it, vi } from 'vitest';

// Storage(미사용 경로) + getOperationalEnvironment 만 mock.
vi.mock('@apps-in-toss/web-framework', () => ({
  Storage: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
  getOperationalEnvironment: vi.fn(),
}));

import { Storage, getOperationalEnvironment } from '@apps-in-toss/web-framework';
import { getToken, isNativeTossEnv } from './toss-session';

const mockEnv = vi.mocked(getOperationalEnvironment);
const mockStorageGet = vi.mocked(Storage.getItem);

/** 테스트용 최소 JWT (exp 초 단위). */
function makeJwt(expSec: number): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256' })}.${b64({ exp: expSec })}.sig`;
}
const nowSec = () => Math.floor(Date.now() / 1000);

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('isNativeTossEnv', () => {
  it("운영 환경이 'toss' 면 네이티브(true)", () => {
    mockEnv.mockReturnValue('toss');
    expect(isNativeTossEnv()).toBe(true);
  });

  it("운영 환경이 'sandbox' 면 네이티브(true) — 실 브릿지에서 appLogin 동작", () => {
    mockEnv.mockReturnValue('sandbox');
    expect(isNativeTossEnv()).toBe(true);
  });

  it('브릿지 부재로 throw 하면 false(브라우저 dev 프리뷰)', () => {
    mockEnv.mockImplementation(() => {
      throw new Error('getOperationalEnvironment is not a constant handler');
    });
    expect(isNativeTossEnv()).toBe(false);
  });
});

describe('getToken — 만료 토큰 폐기 (만료=없음 취급 → 재로그인 유도)', () => {
  it('만료된 저장 토큰 → null', async () => {
    vi.stubEnv('VITE_DEV_BEARER', ''); // dev 오버라이드 회피
    mockEnv.mockReturnValue('toss'); // 네이티브 Storage 경로
    mockStorageGet.mockResolvedValue(makeJwt(nowSec() - 100));
    expect(await getToken()).toBeNull();
  });

  it('유효한 저장 토큰 → 그대로 반환', async () => {
    vi.stubEnv('VITE_DEV_BEARER', '');
    mockEnv.mockReturnValue('toss');
    const valid = makeJwt(nowSec() + 3600);
    mockStorageGet.mockResolvedValue(valid);
    expect(await getToken()).toBe(valid);
  });

  it('저장 토큰 없음 → null', async () => {
    vi.stubEnv('VITE_DEV_BEARER', '');
    mockEnv.mockReturnValue('toss');
    mockStorageGet.mockResolvedValue(null);
    expect(await getToken()).toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

// Storage(미사용 경로) + getOperationalEnvironment 만 mock.
vi.mock('@apps-in-toss/web-framework', () => ({
  Storage: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
  getOperationalEnvironment: vi.fn(),
}));

import { getOperationalEnvironment } from '@apps-in-toss/web-framework';
import { isNativeTossEnv } from './toss-session';

const mockEnv = vi.mocked(getOperationalEnvironment);

afterEach(() => {
  vi.clearAllMocks();
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

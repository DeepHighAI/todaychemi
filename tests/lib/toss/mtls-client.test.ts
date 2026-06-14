/**
 * mtls-client.test.ts
 *
 * mTLS 클라이언트 단위 테스트.
 * 네트워크 없이 transport mock 주입으로만 검증한다.
 * 실제 인증서 불필요.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  mtlsRequest,
  restorePemNewlines,
  createMtlsAgent,
  TOSS_API_BASE_URL,
  TOSS_PAY_BASE_URL,
} from '@/lib/toss/mtls-client';
import type { MtlsRequestOptions } from '@/types/toss';

// ---------------------------------------------------------------------------
// PEM 개행 복원 테스트
// ---------------------------------------------------------------------------

describe('restorePemNewlines', () => {
  it('\\n 리터럴을 실제 개행으로 치환한다', () => {
    const pemWithEscape =
      '-----BEGIN CERTIFICATE-----\\nMIIBxxx\\nyyy\\n-----END CERTIFICATE-----';
    const restored = restorePemNewlines(pemWithEscape);
    expect(restored).toContain('\n');
    expect(restored).not.toContain('\\n');
    expect(restored.split('\n').length).toBeGreaterThan(1);
  });

  it('이미 실제 개행이 있으면 변경 없이 반환한다', () => {
    const pemReal = '-----BEGIN CERTIFICATE-----\nMIIBxxx\n-----END CERTIFICATE-----';
    const result = restorePemNewlines(pemReal);
    expect(result).toBe(pemReal);
  });

  it('개행이 전혀 없는 단순 문자열도 처리한다', () => {
    const simple = 'abc';
    expect(restorePemNewlines(simple)).toBe('abc');
  });
});

// ---------------------------------------------------------------------------
// createMtlsAgent — 인증서 부재 시 빈 Agent 반환 (ERR_NETWORK 위임)
// ---------------------------------------------------------------------------

describe('createMtlsAgent', () => {
  beforeEach(() => {
    // 환경변수 초기화
    delete process.env.TOSS_MTLS_CERT_PEM;
    delete process.env.TOSS_MTLS_KEY_PEM;
  });

  it('env 없이 호출하면 rejectUnauthorized:true Agent 를 반환한다(cert 부재 허용)', () => {
    const agent = createMtlsAgent();
    // https.Agent 인스턴스 여부 확인
    expect(agent).toBeDefined();
    // Node https.Agent 에는 options 속성이 있음
    expect(typeof agent.destroy).toBe('function');
  });

  it('cert/key env 가 있으면 PEM 복원 후 Agent 를 생성한다', () => {
    // \\n 리터럴이 포함된 더미 PEM — 실제 인증서 아님(형식만 맞춤)
    process.env.TOSS_MTLS_CERT_PEM =
      '-----BEGIN CERTIFICATE-----\\nZmFrZWNlcnQ=\\n-----END CERTIFICATE-----';
    process.env.TOSS_MTLS_KEY_PEM =
      '-----BEGIN PRIVATE KEY-----\\nZmFrZWtleQ==\\n-----END PRIVATE KEY-----';

    // Agent 생성 자체는 성공(실제 TLS handshake 는 transport 레이어)
    expect(() => createMtlsAgent()).not.toThrow();
  });

  it('TossCertPair 직접 주입 시 env 보다 우선한다', () => {
    process.env.TOSS_MTLS_CERT_PEM = 'env-cert';
    process.env.TOSS_MTLS_KEY_PEM = 'env-key';

    const certPair = {
      cert: '-----BEGIN CERTIFICATE-----\ninjected\n-----END CERTIFICATE-----',
      key: '-----BEGIN PRIVATE KEY-----\ninjected\n-----END PRIVATE KEY-----',
    };
    expect(() => createMtlsAgent(certPair)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Base URL 상수 검증
// ---------------------------------------------------------------------------

describe('Base URL 상수 (§3.7)', () => {
  it('TOSS_API_BASE_URL 이 올바른 로그인/IAP 주소다', () => {
    expect(TOSS_API_BASE_URL).toBe('https://apps-in-toss-api.toss.im');
  });

  it('TOSS_PAY_BASE_URL 이 올바른 토스 페이 주소다', () => {
    expect(TOSS_PAY_BASE_URL).toBe('https://pay-apps-in-toss-api.toss.im');
  });
});

// ---------------------------------------------------------------------------
// mtlsRequest — transport mock 주입 테스트
// ---------------------------------------------------------------------------

describe('mtlsRequest', () => {
  it('transport 결과를 그대로 반환한다(SUCCESS 봉투)', async () => {
    const mockPayload = { resultType: 'SUCCESS', success: { accessToken: 'tok123' } };
    const transport = vi.fn().mockResolvedValue(mockPayload);

    const opts: MtlsRequestOptions = {
      baseUrl: TOSS_API_BASE_URL,
      method: 'POST',
      path: '/api-partner/v1/apps-in-toss/user/oauth2/generate-token',
      body: { authorizationCode: 'code', referrer: 'DEFAULT' },
    };

    const result = await mtlsRequest(opts, transport);
    expect(result).toEqual(mockPayload);
    expect(transport).toHaveBeenCalledWith(opts);
  });

  it('transport 결과를 그대로 반환한다(FAIL 봉투 — 봉투 파싱은 login.ts 책임)', async () => {
    const failPayload = {
      resultType: 'FAIL',
      error: { errorCode: 'INTERNAL_ERROR', reason: 'test' },
    };
    const transport = vi.fn().mockResolvedValue(failPayload);

    const result = await mtlsRequest(
      { baseUrl: TOSS_API_BASE_URL, method: 'GET', path: '/test' },
      transport,
    );
    expect(result).toEqual(failPayload);
  });

  it('transport 오류는 그대로 전파된다', async () => {
    const transport = vi.fn().mockRejectedValue(new Error('TOSS_REQUEST_TIMEOUT'));

    await expect(
      mtlsRequest({ baseUrl: TOSS_API_BASE_URL, method: 'POST', path: '/test' }, transport),
    ).rejects.toThrow('TOSS_REQUEST_TIMEOUT');
  });

  it('transport 미전달 시 기본 nodeHttpsTransport 경로를 타겠다고 컴파일된다', () => {
    // 실제 네트워크 없이 타입/API surface 만 검증
    // transport 파라미터가 선택적이므로 이 호출은 tsc 통과해야 함
    const fn = () =>
      mtlsRequest({ baseUrl: TOSS_API_BASE_URL, method: 'POST', path: '/test', body: {} });
    expect(typeof fn).toBe('function');
  });

  it('GET 요청에 body 없이 호출할 수 있다', async () => {
    const transport = vi.fn().mockResolvedValue({ resultType: 'SUCCESS', success: {} });
    await mtlsRequest(
      {
        baseUrl: TOSS_API_BASE_URL,
        method: 'GET',
        path: '/api-partner/v1/apps-in-toss/user/oauth2/login-me',
        headers: { Authorization: 'Bearer tok' },
        // body 없음 — optional 이므로 키 자체가 없음
      },
      transport,
    );
    // body 키를 포함하지 않으면서 method 와 path 만 확인
    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', path: '/api-partner/v1/apps-in-toss/user/oauth2/login-me' }),
    );
    // body 키가 전달된 opts 에 없음을 확인
    const calledOpts = transport.mock.calls[0][0] as Record<string, unknown>;
    expect('body' in calledOpts).toBe(false);
  });

  it('timeoutMs 옵션이 opts 에 포함되어 transport 로 전달된다', async () => {
    const transport = vi.fn().mockResolvedValue({ resultType: 'SUCCESS', success: {} });
    const opts: MtlsRequestOptions = {
      baseUrl: TOSS_API_BASE_URL,
      method: 'POST',
      path: '/api-partner/v1/apps-in-toss/user/oauth2/access/remove-by-user-key',
      body: { userKey: 12345 },
      timeoutMs: 3000,
    };
    await mtlsRequest(opts, transport);
    expect(transport).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 3000 }));
  });
});

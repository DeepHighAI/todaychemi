/**
 * mtls-client.ts
 *
 * Apps-in-Toss mTLS HTTPS 클라이언트.
 *
 * ⚠️ 이 모듈을 import 하는 Route Handler 는 반드시:
 *   export const runtime = 'nodejs';
 * 를 선언해야 한다. Node.js 전용 모듈(https, tls)을 사용하므로 Edge runtime 금지.
 *
 * 출처: 구현 레퍼런스 §3.3(env PEM), §3.6(응답 봉투), §3.7(Base URL), §3.8(에러/타임아웃), §3.9(체크리스트)
 */

import https from 'node:https';
import type { MtlsRequestOptions, MtlsTransport, TossCertPair } from '@/types/toss';

// ---------------------------------------------------------------------------
// Base URL 상수 (§3.7)
// ---------------------------------------------------------------------------

/** 토스 로그인 · 메시지 · 프로모션 · IAP 전용 Base URL */
export const TOSS_API_BASE_URL = 'https://apps-in-toss-api.toss.im';

/** 토스 페이 전용 Base URL */
export const TOSS_PAY_BASE_URL = 'https://pay-apps-in-toss-api.toss.im';

// ---------------------------------------------------------------------------
// PEM 개행 복원 (Vercel env 는 개행을 \n 리터럴로 저장)
// ---------------------------------------------------------------------------

/**
 * Vercel 환경변수에서 PEM 을 읽으면 개행이 \n 리터럴로 들어온다.
 * https.Agent cert/key 파라미터는 실제 개행('\n')이 포함된 PEM 문자열이어야 한다.
 */
export function restorePemNewlines(pem: string): string {
  // 이미 실제 개행이 있으면 그대로 반환
  if (pem.includes('\n')) return pem;
  // \n 리터럴을 실제 개행으로 치환
  return pem.replace(/\\n/g, '\n');
}

// ---------------------------------------------------------------------------
// mTLS Agent 팩토리 (공유 Agent — §3.9 체크리스트 1번)
// ---------------------------------------------------------------------------

/**
 * TOSS_MTLS_CERT_PEM / TOSS_MTLS_KEY_PEM 환경변수에서 인증서 쌍을 읽어
 * https.Agent 를 생성한다.
 *
 * cert 회전(§3.2, §3.9 체크리스트 8번):
 *   - 운영: TOSS_MTLS_CERT_PEM + TOSS_MTLS_KEY_PEM (현재 활성)
 *   - 예비: TOSS_MTLS_CERT_PEM_NEXT + TOSS_MTLS_KEY_PEM_NEXT (콘솔 등록 후 교체 예정)
 *   실제 회전 절차: 콘솔에 신규 cert 추가 → Vercel env _NEXT 값 설정 → 구 cert 만료 후 _NEXT 를 현재 값으로 이동.
 *
 * ERR_NETWORK (§3.8): cert 누락/무효 시 https.request 가 ECONNREFUSED/CERT 계열 오류 반환.
 * 이 오류는 서버 outage 가 아닌 cert 설정 문제로 간주.
 */
export function createMtlsAgent(certPair?: TossCertPair): https.Agent {
  const certPem = certPair?.cert ?? process.env.TOSS_MTLS_CERT_PEM ?? '';
  const keyPem = certPair?.key ?? process.env.TOSS_MTLS_KEY_PEM ?? '';

  if (!certPem || !keyPem) {
    // 인증서 부재 — 호출 시 ERR_NETWORK 로 매핑(§3.8)
    // 개발 환경에서 env 가 없는 경우를 허용하되 실제 API 호출 시 실패
    return new https.Agent({ rejectUnauthorized: true });
  }

  return new https.Agent({
    cert: restorePemNewlines(certPem),
    key: restorePemNewlines(keyPem),
    rejectUnauthorized: true,
  });
}

// ---------------------------------------------------------------------------
// 실제 Node https 기반 transport (프로덕션)
// ---------------------------------------------------------------------------

/**
 * Node.js https.request 를 래핑하는 실제 transport 구현.
 * 테스트에서는 이 함수 대신 mock 을 주입한다.
 */
function nodeHttpsTransport(opts: MtlsRequestOptions): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const { baseUrl, method, path, headers = {}, body, timeoutMs } = opts;

    const url = new URL(path, baseUrl);
    const bodyString = body !== undefined ? JSON.stringify(body) : undefined;
    const contentHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };
    if (bodyString !== undefined) {
      contentHeaders['Content-Length'] = Buffer.byteLength(bodyString).toString();
    }

    // 공유 Agent — 환경변수에서 인증서 로드(§3.9 #1)
    const agent = createMtlsAgent();

    const reqOptions: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method,
      headers: contentHeaders,
      agent,
    };

    if (timeoutMs !== undefined) {
      reqOptions.timeout = timeoutMs;
    }

    const req = https.request(reqOptions, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8');
        try {
          resolve(JSON.parse(raw));
        } catch {
          // JSON 파싱 실패 — 원본 텍스트를 그대로 reject
          reject(new Error(`JSON 파싱 실패: ${raw.slice(0, 200)}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('TOSS_REQUEST_TIMEOUT'));
    });

    req.on('error', (err) => {
      // ERR_NETWORK 계열(§3.8) — cert 누락/무효로 취급
      reject(err);
    });

    if (bodyString !== undefined) {
      req.write(bodyString);
    }
    req.end();
  });
}

// ---------------------------------------------------------------------------
// 공개 mtlsRequest 함수 (transport 주입 지원)
// ---------------------------------------------------------------------------

/**
 * Apps-in-Toss mTLS API 를 호출하고 파싱된 JSON 을 반환한다.
 *
 * @param opts - 요청 옵션
 * @param transport - 선택 transport 주입. 테스트에서 mock 을 넘긴다.
 *                   미전달 시 실제 Node https 를 사용한다.
 * @returns 파싱된 JSON 응답 (봉투 판별은 호출자 책임)
 *
 * remove-by-user-key 에는 timeoutMs: 3000 을 설정하고 auto-retry 금지(§3.8).
 * 소비 코드에서 retry 로직을 추가하지 말 것.
 */
export async function mtlsRequest(
  opts: MtlsRequestOptions,
  transport: MtlsTransport = nodeHttpsTransport,
): Promise<unknown> {
  return transport(opts);
}

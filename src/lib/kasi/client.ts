import { KasiLunCalResponseSchema, type KasiLunCalItem } from './types';

export class KasiAuthError extends Error {
  constructor(msg = 'KASI 서비스키 만료 또는 미등록 (resultCode=30)') {
    super(msg);
    this.name = 'KasiAuthError';
  }
}

export class KasiQuotaError extends Error {
  constructor(msg = 'KASI 일일 쿼터 초과 (resultCode=22)') {
    super(msg);
    this.name = 'KasiQuotaError';
  }
}

const KASI_BASE = 'https://apis.data.go.kr/B090041/openapi/service/LrsrCldInfoService/getLunCalInfo';
const MAX_ATTEMPTS = 3;

function extractXmlResultCode(text: string): string | null {
  const m = text.match(/<resultCode>(\d+)<\/resultCode>/);
  return m?.[1] ?? null;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchLunCalInfo(
  year: number,
  month: number,
  day: number,
  serviceKey: string,
  options: { retryDelayMs?: number } = {},
): Promise<KasiLunCalItem> {
  const retryDelayMs = options.retryDelayMs ?? 1000;
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const url =
    `${KASI_BASE}?solYear=${year}&solMonth=${mm}&solDay=${dd}` +
    `&_type=json&serviceKey=${serviceKey}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    let text: string;
    let status: number;
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      status = res.status;
      text = await res.text();
    } catch (err) {
      clearTimeout(timeoutId);
      if (attempt === MAX_ATTEMPTS) throw err;
      await delay(retryDelayMs);
      continue;
    }

    // 5xx → retry
    if (status >= 500) {
      if (attempt === MAX_ATTEMPTS) throw new Error(`KASI server error: ${status}`);
      await delay(retryDelayMs);
      continue;
    }

    // XML error response
    if (text.trimStart().startsWith('<')) {
      const code = extractXmlResultCode(text);
      if (code === '30') throw new KasiAuthError();
      if (code === '22') throw new KasiQuotaError();
      throw new Error(`KASI error: resultCode=${code}`);
    }

    // JSON success/error
    const parsed = KasiLunCalResponseSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      // JSON but not a valid 00-response — check for error codes inline
      const raw = JSON.parse(text) as { response?: { header?: { resultCode?: string } } };
      const code = raw?.response?.header?.resultCode;
      if (code === '30') throw new KasiAuthError();
      if (code === '22') throw new KasiQuotaError();
      throw new Error(`KASI unexpected response: ${text.slice(0, 200)}`);
    }

    return parsed.data.response.body.items.item;
  }

  throw new Error('KASI fetch failed after max retries');
}

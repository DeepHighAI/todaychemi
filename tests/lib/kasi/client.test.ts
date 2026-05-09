import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchLunCalInfo, KasiAuthError, KasiQuotaError } from '@/lib/kasi/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURE_DIR = join(__dirname, '../../fixtures/kasi_responses');
const sampleJson = readFileSync(join(FIXTURE_DIR, 'lun_cal_info_sample.json'), 'utf-8');
const errorAuthXml = readFileSync(join(FIXTURE_DIR, 'error_auth.xml'), 'utf-8');
const errorQuotaXml = readFileSync(join(FIXTURE_DIR, 'error_quota.xml'), 'utf-8');

const KASI_BASE = 'https://apis.data.go.kr/B090041/openapi/service/LrsrCldInfoService/getLunCalInfo';

function mockFetch(body: string, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body),
  } as Response);
}

describe('fetchLunCalInfo', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('builds a URL that includes the serviceKey', async () => {
    const fetchMock = mockFetch(sampleJson);
    vi.stubGlobal('fetch', fetchMock);

    await fetchLunCalInfo(1990, 3, 15, 'MY_KEY', { retryDelayMs: 0 });

    const calledUrl: string = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain(KASI_BASE);
    expect(calledUrl).toContain('serviceKey=MY_KEY');
    expect(calledUrl).toContain('solYear=1990');
    expect(calledUrl).toContain('_type=json');
    // KASI API는 월/일을 두 자리로 zero-pad 해야 totalCount>0 반환
    expect(calledUrl).toContain('solMonth=03');
    expect(calledUrl).toContain('solDay=15');
  });

  it('returns the parsed KasiLunCalItem on success', async () => {
    vi.stubGlobal('fetch', mockFetch(sampleJson));

    const item = await fetchLunCalInfo(1990, 3, 15, 'KEY', { retryDelayMs: 0 });

    expect(item.lunSecha).toBe('庚午');
    expect(item.lunIljin).toBe('壬子');
  });

  it('throws KasiAuthError when resultCode is 30', async () => {
    vi.stubGlobal('fetch', mockFetch(errorAuthXml));

    await expect(fetchLunCalInfo(1990, 3, 15, 'BAD_KEY', { retryDelayMs: 0 })).rejects.toThrow(KasiAuthError);
  });

  it('throws KasiQuotaError when resultCode is 22', async () => {
    vi.stubGlobal('fetch', mockFetch(errorQuotaXml));

    await expect(fetchLunCalInfo(1990, 3, 15, 'KEY', { retryDelayMs: 0 })).rejects.toThrow(KasiQuotaError);
  });

  it('retries up to 3 times on 5xx then throws', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, text: () => Promise.resolve('error') })
      .mockResolvedValueOnce({ ok: false, status: 503, text: () => Promise.resolve('error') })
      .mockResolvedValueOnce({ ok: false, status: 503, text: () => Promise.resolve('error') });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchLunCalInfo(1990, 3, 15, 'KEY', { retryDelayMs: 0 })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

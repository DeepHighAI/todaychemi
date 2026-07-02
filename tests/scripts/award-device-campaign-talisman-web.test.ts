import { once } from 'node:events';
import type { AddressInfo } from 'node:net';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { awardDeviceCampaignTalisman, type RpcClient } from '../../scripts/award-device-campaign-talisman';
import {
  createGrantDeviceTalismanWebServer,
  describeAwardResult,
  isLocalRequestAllowed,
  loadEnvLocal,
  mapGrantError,
} from '../../scripts/award-device-campaign-talisman-web';
import { hashTossDeviceId } from '@/lib/toss/device';

const TOKEN = 'local-test-token';
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  process.env.TOSS_DEVICE_ID_HASH_SECRET = 'device-hash-secret-for-tests';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('award-device-campaign-talisman-web ops tool', () => {
  it('rejects requests without the local ops token', async () => {
    const { baseUrl, close } = await startServer({ rpc: vi.fn() });
    try {
      const response = await fetch(`${baseUrl}/`);
      expect(response.status).toBe(403);
    } finally {
      await close();
    }
  });

  it('rejects non-local host, origin, or token combinations before grant handling', () => {
    const request = {
      method: 'POST',
      url: '/api/grant?token=bad-token',
      socket: { remoteAddress: '203.0.113.7' },
      headers: {
        host: 'evil.example',
        origin: 'https://evil.example',
      },
    };

    expect(isLocalRequestAllowed(request as never, { token: TOKEN, port: 8787 })).toBe(false);
  });

  it('renders the page without leaking service-role secrets', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret-should-not-render';
    const { baseUrl, close } = await startServer({ rpc: vi.fn() });
    try {
      const response = await fetch(`${baseUrl}/?token=${TOKEN}`);
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(html).toContain('오늘케미 로컬 부적 지급');
      expect(html).toContain('운영 지원 ID(userId)');
      expect(html).toContain('127.0.0.1 전용');
      expect(html).not.toContain('service-role-secret-should-not-render');
    } finally {
      await close();
    }
  });

  it('dry-run returns a safe result and does not call the Supabase RPC', async () => {
    const rpc = vi.fn();
    const { baseUrl, close } = await startServer({ rpc });
    try {
      const response = await postGrant(baseUrl, {
        campaignKey: 'launch_bonus_202607',
        deviceId: 'raw-device-id',
        amount: 10,
        dryRun: true,
      });
      const json = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(rpc).not.toHaveBeenCalled();
      expect(JSON.stringify(json)).toContain('DRY_RUN');
      expect(JSON.stringify(json)).not.toContain('raw-device-id');
    } finally {
      await close();
    }
  });

  it('maps missing device hash secret to an actionable safe response', async () => {
    delete process.env.TOSS_DEVICE_ID_HASH_SECRET;
    delete process.env.TOSS_USER_PASSWORD_SECRET;
    const rpc = vi.fn();
    const { baseUrl, close } = await startServer({ rpc });
    try {
      const response = await postGrant(baseUrl, {
        campaignKey: 'launch_bonus_202607',
        deviceId: 'raw-device-id',
        amount: 10,
        dryRun: true,
      });
      const json = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(500);
      expect(rpc).not.toHaveBeenCalled();
      expect(json.error).toBe('CONFIG_MISSING_DEVICE_HASH_SECRET');
      expect(json.message).toBe('로컬 해시 secret이 없어 deviceId를 검증할 수 없습니다.');
      expect(JSON.stringify(json)).not.toContain('raw-device-id');
    } finally {
      await close();
    }
  });

  it('userId dry-run does not require device hash secrets and does not call the Supabase RPC', async () => {
    delete process.env.TOSS_DEVICE_ID_HASH_SECRET;
    delete process.env.TOSS_USER_PASSWORD_SECRET;
    const rpc = vi.fn();
    const { baseUrl, close } = await startServer({ rpc });
    try {
      const response = await postGrant(baseUrl, {
        targetType: 'user',
        campaignKey: 'launch_bonus_202607',
        userId: '11111111-2222-3333-4444-555555555555',
        amount: 10,
        dryRun: true,
      });
      const json = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(rpc).not.toHaveBeenCalled();
      expect(JSON.stringify(json)).toContain('DRY_RUN');
    } finally {
      await close();
    }
  });

  it('actual grant hashes the device id before calling the protected RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        awarded: true,
        reason: 'AWARDED',
        amount_awarded: 10,
        balance_after: 42,
        ledger_id: 'ledger-1',
      },
      error: null,
    });
    const { baseUrl, close } = await startServer({ rpc });
    try {
      const response = await postGrant(baseUrl, {
        campaignKey: 'launch_bonus_202607',
        deviceId: 'raw-device-id',
        amount: 10,
        dryRun: false,
      });
      const json = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(rpc).toHaveBeenCalledWith('award_device_campaign_talisman', {
        p_campaign_key: 'launch_bonus_202607',
        p_device_id_hash: hashTossDeviceId('raw-device-id', 'device-hash-secret-for-tests'),
        p_amount: 10,
      });
      expect(JSON.stringify(rpc.mock.calls)).not.toContain('raw-device-id');
      expect(JSON.stringify(json)).toContain('AWARDED');
      expect(JSON.stringify(json)).not.toContain('raw-device-id');
    } finally {
      await close();
    }
  });

  it('actual userId grant calls the protected user RPC without device hashing', async () => {
    delete process.env.TOSS_DEVICE_ID_HASH_SECRET;
    delete process.env.TOSS_USER_PASSWORD_SECRET;
    const rpc = vi.fn().mockResolvedValue({
      data: {
        awarded: true,
        reason: 'AWARDED',
        amount_awarded: 10,
        balance_after: 42,
        ledger_id: 'ledger-1',
      },
      error: null,
    });
    const { baseUrl, close } = await startServer({ rpc });
    try {
      const response = await postGrant(baseUrl, {
        targetType: 'user',
        campaignKey: 'launch_bonus_202607',
        userId: '11111111-2222-3333-4444-555555555555',
        amount: 10,
        dryRun: false,
      });
      const json = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(rpc).toHaveBeenCalledWith('award_user_campaign_talisman', {
        p_campaign_key: 'launch_bonus_202607',
        p_user_id: '11111111-2222-3333-4444-555555555555',
        p_amount: 10,
      });
      expect(JSON.stringify(json)).toContain('AWARDED');
    } finally {
      await close();
    }
  });

  it('surfaces known result states for operators', () => {
    expect(describeAwardResult('DEVICE_NOT_REGISTERED')).toEqual({
      message: '이 deviceId로 연결된 사용자를 찾지 못했습니다.',
      nextStep: '사용자가 최신 미니앱을 1회 연 뒤 다시 지급하세요.',
    });
    expect(describeAwardResult('ALREADY_AWARDED').message).toContain('이미');
    expect(describeAwardResult('AWARDED').message).toContain('완료');
    expect(describeAwardResult('USER_NOT_FOUND').message).toContain('userId');
  });

  it('maps Supabase RPC errors without exposing provider details', () => {
    expect(mapGrantError(new Error('award_device_campaign_talisman failed: relation missing'))).toEqual({
      status: 502,
      code: 'SUPABASE_RPC_ERROR',
      message: 'Supabase 지급 RPC 호출이 실패했습니다.',
      nextStep: '네트워크, Supabase 상태, 마이그레이션 적용 여부를 확인하세요.',
    });
    expect(mapGrantError(new Error('award_user_campaign_talisman failed: relation missing'))).toEqual({
      status: 502,
      code: 'SUPABASE_RPC_ERROR',
      message: 'Supabase 지급 RPC 호출이 실패했습니다.',
      nextStep: '네트워크, Supabase 상태, 마이그레이션 적용 여부를 확인하세요.',
    });
  });

  it('manual env loader keeps process env precedence over .env.local values', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://from-process.example';
    loadEnvLocal('tests/fixtures/ops-grant-device.env');

    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://from-process.example');
    expect(process.env.TOSS_USER_PASSWORD_SECRET).toBe('fixture-device-secret');
  });

  it('keeps dry-run no-RPC behavior in the shared grant function used by the web tool', async () => {
    const rpc = vi.fn();

    await awardDeviceCampaignTalisman({
      campaignKey: 'launch_bonus_202607',
      deviceId: 'raw-device-id',
      amount: 10,
      dryRun: true,
    }, { rpc } as never);

    expect(rpc).not.toHaveBeenCalled();
  });
});

async function startServer(options: { rpc: ReturnType<typeof vi.fn> }) {
  const server = createGrantDeviceTalismanWebServer({
    token: TOKEN,
    port: 0,
    rpcClient: { rpc: options.rpc } as RpcClient,
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  const port = address.port;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: async () => {
      server.close();
      await once(server, 'close');
    },
  };
}

async function postGrant(baseUrl: string, body: Record<string, unknown>) {
  const port = new URL(baseUrl).port;
  return fetch(`${baseUrl}/api/grant?token=${TOKEN}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-ops-token': TOKEN,
      origin: `http://127.0.0.1:${port}`,
    },
    body: JSON.stringify(body),
  });
}

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  awardDeviceCampaignTalisman,
  awardUserCampaignTalisman,
  formatAwardResult,
  parseArgs,
  type AwardDeviceCampaignArgs,
  type AwardUserCampaignArgs,
} from '../../scripts/award-device-campaign-talisman';
import { hashTossDeviceId } from '@/lib/toss/device';

const BASE_ARGS: AwardDeviceCampaignArgs = {
  campaignKey: 'launch_bonus_202607',
  deviceId: 'raw-device-id',
  amount: 10,
  dryRun: false,
};
const USER_ID = '11111111-2222-3333-4444-555555555555';
const USER_ARGS: AwardUserCampaignArgs = {
  campaignKey: 'launch_bonus_202607',
  userId: USER_ID,
  amount: 10,
  dryRun: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.TOSS_DEVICE_ID_HASH_SECRET = 'device-hash-secret-for-tests';
});

describe('award-device-campaign-talisman ops script', () => {
  it('parses required CLI arguments', () => {
    expect(parseArgs([
      '--campaign',
      'launch_bonus_202607',
      '--device-id',
      'raw-device-id',
      '--amount',
      '10',
      '--dry-run',
    ])).toEqual({
      campaignKey: 'launch_bonus_202607',
      deviceId: 'raw-device-id',
      amount: 10,
      dryRun: true,
    });
  });

  it('parses userId grant CLI arguments', () => {
    expect(parseArgs([
      '--campaign',
      'launch_bonus_202607',
      '--user-id',
      USER_ID,
      '--amount',
      '10',
      '--dry-run',
    ])).toEqual({
      campaignKey: 'launch_bonus_202607',
      userId: USER_ID,
      amount: 10,
      dryRun: true,
    });
  });

  it('rejects invalid campaign keys', () => {
    expect(() => parseArgs([
      '--campaign',
      'Launch Bonus',
      '--device-id',
      'raw-device-id',
      '--amount',
      '10',
    ])).toThrow('Invalid --campaign');
  });

  it('hashes device id and calls the protected RPC without sending raw device id', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { awarded: true, reason: 'AWARDED', amount_awarded: 10, balance_after: 30 },
      error: null,
    });

    const result = await awardDeviceCampaignTalisman(BASE_ARGS, { rpc } as never);

    expect(rpc).toHaveBeenCalledWith('award_device_campaign_talisman', {
      p_campaign_key: 'launch_bonus_202607',
      p_device_id_hash: hashTossDeviceId('raw-device-id', 'device-hash-secret-for-tests'),
      p_amount: 10,
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('raw-device-id');
    expect(result).toEqual({ awarded: true, reason: 'AWARDED', amount_awarded: 10, balance_after: 30 });
  });

  it('dry-run validates locally without calling Supabase', async () => {
    const rpc = vi.fn();

    const result = await awardDeviceCampaignTalisman({ ...BASE_ARGS, dryRun: true }, { rpc } as never);

    expect(rpc).not.toHaveBeenCalled();
    expect(result.reason).toBe('DRY_RUN');
  });

  it('userId dry-run does not require the device hash secret and does not call Supabase', async () => {
    delete process.env.TOSS_DEVICE_ID_HASH_SECRET;
    delete process.env.TOSS_USER_PASSWORD_SECRET;
    const rpc = vi.fn();

    const result = await awardUserCampaignTalisman({ ...USER_ARGS, dryRun: true }, { rpc } as never);

    expect(rpc).not.toHaveBeenCalled();
    expect(result.reason).toBe('DRY_RUN');
  });

  it('userId grant calls the protected user RPC without device hash secret', async () => {
    delete process.env.TOSS_DEVICE_ID_HASH_SECRET;
    delete process.env.TOSS_USER_PASSWORD_SECRET;
    const rpc = vi.fn().mockResolvedValue({
      data: { awarded: true, reason: 'AWARDED', amount_awarded: 10, balance_after: 30 },
      error: null,
    });

    const result = await awardUserCampaignTalisman(USER_ARGS, { rpc } as never);

    expect(rpc).toHaveBeenCalledWith('award_user_campaign_talisman', {
      p_campaign_key: 'launch_bonus_202607',
      p_user_id: USER_ID,
      p_amount: 10,
    });
    expect(result).toEqual({ awarded: true, reason: 'AWARDED', amount_awarded: 10, balance_after: 30 });
  });

  it('formats operational next step for unregistered devices without leaking raw device id', () => {
    const output = formatAwardResult(BASE_ARGS, {
      awarded: false,
      reason: 'DEVICE_NOT_REGISTERED',
      amount_awarded: 0,
      balance_after: null,
    });

    expect(output).toContain('DEVICE_NOT_REGISTERED');
    expect(output).toContain('최신 미니앱을 1회 열어');
    expect(output).not.toContain('raw-device-id');
  });
});

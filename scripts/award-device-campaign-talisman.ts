import { pathToFileURL } from 'node:url';

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { hashTossDeviceId } from '@/lib/toss/device';

export interface AwardDeviceCampaignArgs {
  campaignKey: string;
  deviceId: string;
  amount: number;
  dryRun: boolean;
}

export interface AwardUserCampaignArgs {
  campaignKey: string;
  userId: string;
  amount: number;
  dryRun: boolean;
}

export interface AwardResult {
  awarded?: boolean;
  reason?: string;
  amount_awarded?: number;
  balance_after?: number | null;
  ledger_id?: string | null;
}

export type RpcClient = Pick<ReturnType<typeof createServiceRoleClient>, 'rpc'>;

function usage(): never {
  throw new Error(
    [
      'Usage:',
      '  pnpm ops:grant-device-talisman -- --campaign <campaign_key> --device-id <apps_in_toss_device_id> --amount <count>',
      '  pnpm ops:grant-user-talisman -- --campaign <campaign_key> --user-id <supabase_user_id> --amount <count>',
      '',
      'Options:',
      '  --campaign   Required. Lowercase campaign key, e.g. launch_bonus_202607',
      '  --device-id  Required. Raw Apps in Toss getDeviceId() return value. Never printed or stored raw.',
      '  --user-id    Required for user grant mode. Supabase auth/public.users UUID.',
      '  --amount     Required. Positive integer talisman amount.',
      '  --dry-run    Validate locally without calling Supabase.',
    ].join('\n'),
  );
}

function readFlag(args: string[], name: string): string | null {
  const withEquals = args.find((arg) => arg.startsWith(`${name}=`));
  if (withEquals) return withEquals.slice(name.length + 1);

  const index = args.indexOf(name);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) usage();
  return value;
}

export function parseArgs(argv: string[]): AwardDeviceCampaignArgs | AwardUserCampaignArgs {
  if (argv.includes('--help') || argv.includes('-h')) usage();

  const campaignKey = readFlag(argv, '--campaign')?.trim();
  const deviceId = readFlag(argv, '--device-id')?.trim();
  const userId = readFlag(argv, '--user-id')?.trim();
  const amountRaw = readFlag(argv, '--amount')?.trim();
  const amount = amountRaw ? Number(amountRaw) : NaN;

  if (!campaignKey || (!deviceId && !userId) || (deviceId && userId) || !Number.isInteger(amount) || amount <= 0) {
    usage();
  }

  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(campaignKey)) {
    throw new Error('Invalid --campaign. Use lowercase letters, numbers, underscores, or hyphens.');
  }

  if (userId && !isUuid(userId)) {
    throw new Error('Invalid --user-id. Use a Supabase UUID.');
  }

  if (userId) {
    return {
      campaignKey,
      userId: userId.toLowerCase(),
      amount,
      dryRun: argv.includes('--dry-run'),
    };
  }

  return {
    campaignKey,
    deviceId: deviceId!,
    amount,
    dryRun: argv.includes('--dry-run'),
  };
}

export async function awardDeviceCampaignTalisman(
  args: AwardDeviceCampaignArgs,
  client?: RpcClient,
): Promise<AwardResult> {
  const deviceIdHash = hashTossDeviceId(args.deviceId);

  if (args.dryRun) {
    return {
      awarded: false,
      reason: 'DRY_RUN',
      amount_awarded: 0,
      balance_after: null,
    };
  }

  const rpcClient = client ?? createServiceRoleClient();
  const { data, error } = await rpcClient.rpc('award_device_campaign_talisman', {
    p_campaign_key: args.campaignKey,
    p_device_id_hash: deviceIdHash,
    p_amount: args.amount,
  });

  if (error) {
    throw new Error(`award_device_campaign_talisman failed: ${error.message}`);
  }

  return normalizeAwardResult(data);
}

export async function awardUserCampaignTalisman(
  args: AwardUserCampaignArgs,
  client?: RpcClient,
): Promise<AwardResult> {
  if (args.dryRun) {
    return {
      awarded: false,
      reason: 'DRY_RUN',
      amount_awarded: 0,
      balance_after: null,
    };
  }

  const rpcClient = client ?? createServiceRoleClient();
  const { data, error } = await rpcClient.rpc('award_user_campaign_talisman', {
    p_campaign_key: args.campaignKey,
    p_user_id: args.userId,
    p_amount: args.amount,
  });

  if (error) {
    throw new Error(`award_user_campaign_talisman failed: ${error.message}`);
  }

  return normalizeAwardResult(data);
}

export function formatAwardResult(args: AwardDeviceCampaignArgs | AwardUserCampaignArgs, result: AwardResult): string {
  const lines = [
    'Campaign talisman grant result',
    `campaign: ${args.campaignKey}`,
    `target: ${'userId' in args ? 'user_id' : 'device_id'}`,
    `requested_amount: ${args.amount}`,
    `awarded: ${Boolean(result.awarded)}`,
    `reason: ${result.reason ?? 'UNKNOWN'}`,
  ];

  if (typeof result.amount_awarded === 'number') {
    lines.push(`amount_awarded: ${result.amount_awarded}`);
  }
  if (typeof result.balance_after === 'number') {
    lines.push(`balance_after: ${result.balance_after}`);
  }
  if (result.ledger_id) {
    lines.push(`ledger_id: ${result.ledger_id}`);
  }
  if (result.reason === 'DEVICE_NOT_REGISTERED') {
    lines.push('next_step: 사용자가 최신 미니앱을 1회 열어 device mapping 을 생성한 뒤 다시 지급하세요.');
  }
  if (result.reason === 'AMBIGUOUS_DEVICE') {
    lines.push('next_step: 같은 device hash 가 여러 user_id 와 연결되어 자동 지급을 보류했습니다.');
  }
  if (result.reason === 'USER_NOT_FOUND') {
    lines.push('next_step: userId 가 올바른지, 사용자가 온보딩을 완료했는지 확인하세요.');
  }

  return lines.join('\n');
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function normalizeAwardResult(data: unknown): AwardResult {
  if (!data || typeof data !== 'object') return {};
  return data as AwardResult;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = 'userId' in args
    ? await awardUserCampaignTalisman(args)
    : await awardDeviceCampaignTalisman(args);
  console.log(formatAwardResult(args, result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

import { createHmac } from 'node:crypto';

const DEVICE_ID_MAX_LENGTH = 512;

function readDeviceHashSecret(): string {
  const secret = process.env.TOSS_DEVICE_ID_HASH_SECRET ?? process.env.TOSS_USER_PASSWORD_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error('TOSS_DEVICE_ID_HASH_SECRET is not configured');
  }
  return secret;
}

export function normalizeTossDeviceId(deviceId: string): string {
  const normalized = deviceId.trim();
  if (normalized.length === 0 || normalized.length > DEVICE_ID_MAX_LENGTH) {
    throw new Error('INVALID_DEVICE_ID');
  }
  return normalized;
}

export function hashTossDeviceId(deviceId: string, secret = readDeviceHashSecret()): string {
  return createHmac('sha256', secret)
    .update(normalizeTossDeviceId(deviceId), 'utf8')
    .digest('hex');
}

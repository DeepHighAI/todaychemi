import { describe, expect, it } from 'vitest';

import { hashTossDeviceId, normalizeTossDeviceId } from '@/lib/toss/device';

describe('toss device hashing', () => {
  it('hashes a raw Apps in Toss device id with HMAC-SHA256', () => {
    const hash = hashTossDeviceId(' device-abc ', 'secret-for-test');

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain('device-abc');
    expect(hash).toBe(hashTossDeviceId('device-abc', 'secret-for-test'));
  });

  it('rejects empty device ids', () => {
    expect(() => normalizeTossDeviceId('   ')).toThrow('INVALID_DEVICE_ID');
  });
});

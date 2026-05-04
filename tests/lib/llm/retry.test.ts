import { describe, it, expect, vi } from 'vitest';
import { retryOnce } from '@/lib/llm/retry';

describe('retryOnce — 1회 재시도 헬퍼', () => {
  it('1차 성공 → fn 1회만 호출, 결과 반환', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retryOnce(fn, { isRetryable: () => true });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('1차 실패(재시도 가능) + 2차 성공 → fn 2회 호출, 결과 반환', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce('recovered');
    const result = await retryOnce(fn, { isRetryable: () => true });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('1차 실패(재시도 불가) → 즉시 throw, fn 1회만 호출', async () => {
    const err = new Error('auth-error');
    const fn = vi.fn().mockRejectedValueOnce(err);
    await expect(retryOnce(fn, { isRetryable: () => false })).rejects.toThrow('auth-error');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('1차 실패(재시도 가능) + 2차 실패 → 2차 에러 throw, fn 2회 호출', async () => {
    const err1 = new Error('first');
    const err2 = new Error('second');
    const fn = vi
      .fn()
      .mockRejectedValueOnce(err1)
      .mockRejectedValueOnce(err2);
    await expect(retryOnce(fn, { isRetryable: () => true })).rejects.toThrow('second');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('isRetryable 콜백이 1차 에러 객체를 받음', async () => {
    const err = new Error('check-me');
    const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValueOnce('ok');
    const isRetryable = vi.fn().mockReturnValue(true);
    await retryOnce(fn, { isRetryable });
    expect(isRetryable).toHaveBeenCalledWith(err);
  });

  it('2회 이상 재시도 금지 — 2차 실패 시 즉시 throw (3차 호출 없음)', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('a'))
      .mockRejectedValueOnce(new Error('b'))
      .mockResolvedValueOnce('unreachable');
    await expect(retryOnce(fn, { isRetryable: () => true })).rejects.toThrow('b');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

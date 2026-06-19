import { afterEach, describe, expect, it, vi } from 'vitest';

import { setReauthHandler, triggerReauth, __resetReauthForTest } from './reauth';

afterEach(() => {
  __resetReauthForTest();
  vi.restoreAllMocks();
});

describe('triggerReauth', () => {
  it('핸들러 미등록 → null', async () => {
    expect(await triggerReauth()).toBeNull();
  });

  it('핸들러 결과(새 토큰)를 반환한다', async () => {
    setReauthHandler(async () => 'fresh');
    expect(await triggerReauth()).toBe('fresh');
  });

  it('single-flight — 동시 다발 호출에 핸들러는 1회만 실행', async () => {
    let calls = 0;
    // deferred promise 를 미리 만들어 resolveHandler 를 동기적으로 확보(핸들러 실행은 마이크로태스크 지연).
    let resolveHandler!: (v: string) => void;
    const pending = new Promise<string>((resolve) => {
      resolveHandler = resolve;
    });
    setReauthHandler(() => {
      calls += 1;
      return pending;
    });

    const p1 = triggerReauth();
    const p2 = triggerReauth();
    resolveHandler('fresh');
    const [a, b] = await Promise.all([p1, p2]);

    expect(calls).toBe(1);
    expect(a).toBe('fresh');
    expect(b).toBe('fresh');
  });

  it('핸들러 throw → null (삼킴, 호출자 보호)', async () => {
    setReauthHandler(async () => {
      throw new Error('appLogin failed');
    });
    expect(await triggerReauth()).toBeNull();
  });

  it('한 사이클 종료 후 inflight 해제 → 재트리거 가능', async () => {
    let calls = 0;
    setReauthHandler(async () => `t${(calls += 1)}`);
    expect(await triggerReauth()).toBe('t1');
    expect(await triggerReauth()).toBe('t2');
    expect(calls).toBe(2);
  });
});

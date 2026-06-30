import { afterEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  eventLog: vi.fn((_params: unknown): Promise<void> | undefined => Promise.resolve()),
}));

vi.mock('@apps-in-toss/web-framework', () => ({
  eventLog: h.eventLog,
}));

import { trackTalismanEvent } from './ait-analytics';

afterEach(() => {
  vi.clearAllMocks();
});

describe('trackTalismanEvent', () => {
  it('eventLog 를 log_type=event 와 함께 호출하고 element/theme 만 params 로 보낸다', () => {
    trackTalismanEvent('talisman_complete', { element: '목', theme: 'growth' });

    expect(h.eventLog).toHaveBeenCalledWith({
      log_name: 'talisman_complete',
      log_type: 'event',
      params: { element: '목', theme: 'growth' },
    });
  });

  it('eventLog 가 throw 해도 호출자에게 전파하지 않는다(토스 외 환경 안전)', () => {
    h.eventLog.mockImplementationOnce(() => {
      throw new Error('not in toss');
    });

    expect(() => trackTalismanEvent('talisman_view', { element: '수', theme: 'clarity' })).not.toThrow();
  });

  it('eventLog 가 reject 해도 unhandled rejection 을 만들지 않는다', async () => {
    h.eventLog.mockImplementationOnce(() => Promise.reject(new Error('bridge down')));

    expect(() => trackTalismanEvent('talisman_start', { element: '화', theme: 'emotion' })).not.toThrow();
    // microtask flush — catch 가 붙어 있어 unhandled 가 없어야 한다.
    await Promise.resolve();
  });
});

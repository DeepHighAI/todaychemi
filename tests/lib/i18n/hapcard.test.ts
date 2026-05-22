import { describe, it, expect } from 'vitest';
import messages from '../../../messages/ko.json';

describe('i18n hapcard 네임스페이스 soft-term 변환 (ko)', () => {
  const hapcard = (messages as Record<string, unknown>).hapcard as Record<string, unknown>;

  it('gauge.breakdown 소프트 용어 포함', () => {
    const gauge = hapcard?.gauge as Record<string, unknown> | undefined;
    const breakdown = gauge?.breakdown as string | undefined;
    expect(breakdown).toMatch(/끌림/);
    expect(breakdown).toMatch(/긴장/);
    expect(breakdown).toMatch(/부딪힘/);
    expect(breakdown).toMatch(/소모/);
  });

  it('gauge.breakdown 형식 "{h} · {s} · {o} · {m}" 포함', () => {
    const gauge = hapcard?.gauge as Record<string, unknown> | undefined;
    const breakdown = gauge?.breakdown as string | undefined;
    expect(breakdown).toMatch(/\{h\}/);
    expect(breakdown).toMatch(/\{s\}/);
    expect(breakdown).toMatch(/\{o\}/);
    expect(breakdown).toMatch(/\{m\}/);
  });

  it('evidence.title 이 "왜 이런 사이?"', () => {
    const evidence = hapcard?.evidence as Record<string, unknown> | undefined;
    expect(evidence?.title).toBe('왜 이런 사이?');
  });
});

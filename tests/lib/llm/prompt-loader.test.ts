import { describe, it, expect, vi } from 'vitest';
import {
  loadActivePrompt,
  loadPromptForUser,
  sampleForCanary,
  MODE_TO_PROMPT_NAME,
} from '@/lib/llm/prompt-loader';
import type { Mode } from '@/types/mode';

interface FakePromptRow {
  prompt_name: string;
  version: string;
  content: string;
  status: 'active' | 'canary' | 'rolled_back';
  canary_ratio?: number | null;
}

function makeFakeClient(rows: FakePromptRow[]) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn((col1: string, val1: string) => ({
          eq: vi.fn((col2: string, val2: string) => ({
            maybeSingle: vi.fn(async () => {
              const matched = rows.find(
                (r) =>
                  (col1 === 'prompt_name' ? r.prompt_name === val1 : r.status === val1) &&
                  (col2 === 'status' ? r.status === val2 : r.prompt_name === val2),
              );
              return matched
                ? { data: matched, error: null }
                : { data: null, error: null };
            }),
          })),
        })),
      })),
    })),
  };
}

describe('loadActivePrompt — DB active 행만', () => {
  describe('mode → prompt_name 매핑', () => {
    it('6모드 모두 영문 prompt_name 매핑', () => {
      expect(MODE_TO_PROMPT_NAME['일합']).toBe('ilhap');
      expect(MODE_TO_PROMPT_NAME['친구합']).toBe('chinguhap');
      expect(MODE_TO_PROMPT_NAME['돈합']).toBe('donhap');
      expect(MODE_TO_PROMPT_NAME['첫합']).toBe('cheothap');
      expect(MODE_TO_PROMPT_NAME['썸합']).toBe('sseomhap');
      expect(MODE_TO_PROMPT_NAME['오래합']).toBe('oraehap');
    });
  });

  describe('active 행 조회', () => {
    it('일합 active 행 반환', async () => {
      const client = makeFakeClient([
        { prompt_name: 'ilhap', version: 'v0.2', content: 'ILHAP_CONTENT', status: 'active' },
      ]);
      const result = await loadActivePrompt(client as never, '일합');
      expect(result.prompt_name).toBe('ilhap');
      expect(result.version).toBe('v0.2');
      expect(result.content).toBe('ILHAP_CONTENT');
    });

    it('친구합 active 행 반환', async () => {
      const client = makeFakeClient([
        { prompt_name: 'chinguhap', version: 'v0.2', content: 'CHINGUHAP_CONTENT', status: 'active' },
      ]);
      const result = await loadActivePrompt(client as never, '친구합');
      expect(result.prompt_name).toBe('chinguhap');
      expect(result.content).toBe('CHINGUHAP_CONTENT');
    });
  });

  describe('canary 무시 (Q6)', () => {
    it('canary 행만 있으면 PROMPT_NOT_FOUND', async () => {
      const client = makeFakeClient([
        { prompt_name: 'ilhap', version: 'v0.3', content: 'CANARY_CONTENT', status: 'canary' },
      ]);
      await expect(loadActivePrompt(client as never, '일합')).rejects.toThrow('PROMPT_NOT_FOUND');
    });
  });

  describe('미존재 → PROMPT_NOT_FOUND', () => {
    it('빈 테이블 → PROMPT_NOT_FOUND', async () => {
      const client = makeFakeClient([]);
      await expect(loadActivePrompt(client as never, '일합')).rejects.toThrow('PROMPT_NOT_FOUND');
    });

    it('다른 모드만 있으면 PROMPT_NOT_FOUND', async () => {
      const client = makeFakeClient([
        { prompt_name: 'chinguhap', version: 'v0.2', content: 'X', status: 'active' },
      ]);
      await expect(loadActivePrompt(client as never, '일합')).rejects.toThrow('PROMPT_NOT_FOUND');
    });
  });

  describe('DB 에러 전파', () => {
    it('Supabase error 발생 시 throw', async () => {
      const errorClient = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: null,
                  error: { message: 'connection refused' },
                })),
              })),
            })),
          })),
        })),
      };
      await expect(
        loadActivePrompt(errorClient as never, '일합' as Mode),
      ).rejects.toThrow();
    });
  });
});

// Task 2 (ADR-008) — canary 5% 분산 라우팅
function makeMultiRowClient(rows: FakePromptRow[]) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn((_col: string, name: string) => ({
          in: vi.fn(async () => ({
            data: rows.filter((r) => r.prompt_name === name),
            error: null,
          })),
        })),
      })),
    })),
  };
}

describe('sampleForCanary — deterministic SHA-256 hash sampling', () => {
  it('동일 userId+promptName → 동일 sample (deterministic)', () => {
    const a = sampleForCanary('user-1', 'ilhap');
    const b = sampleForCanary('user-1', 'ilhap');
    expect(a).toBe(b);
  });

  it('sample 값은 0~1 범위', () => {
    for (const uid of ['user-1', 'user-2', 'user-999', 'abcd-1234']) {
      const s = sampleForCanary(uid, 'ilhap');
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  it('다른 userId → 다른 sample (충돌 매우 드묾)', () => {
    const a = sampleForCanary('user-1', 'ilhap');
    const b = sampleForCanary('user-2', 'ilhap');
    expect(a).not.toBe(b);
  });

  it('같은 userId 다른 promptName → 다른 sample (cross-prompt 독립성)', () => {
    const a = sampleForCanary('user-1', 'ilhap');
    const b = sampleForCanary('user-1', 'chinguhap');
    expect(a).not.toBe(b);
  });

  it('1000 userId / ratio=0.05 → canary 선택률 5% ±1.5%', () => {
    let canaryCount = 0;
    for (let i = 0; i < 1000; i++) {
      if (sampleForCanary(`user-${i}`, 'ilhap') < 0.05) canaryCount++;
    }
    // 표본 분산 sqrt(1000*0.05*0.95) ≈ 6.9 → ±1.5% = ±15건 안전 마진
    expect(canaryCount).toBeGreaterThan(35);
    expect(canaryCount).toBeLessThan(65);
  });

  it('1000 userId / ratio=0.10 → canary 선택률 10% ±2.5%', () => {
    let canaryCount = 0;
    for (let i = 0; i < 1000; i++) {
      if (sampleForCanary(`user-${i}`, 'donhap') < 0.10) canaryCount++;
    }
    expect(canaryCount).toBeGreaterThan(75);
    expect(canaryCount).toBeLessThan(125);
  });
});

describe('loadPromptForUser — canary 5% routing', () => {
  it('active 만 있으면 active 반환', async () => {
    const client = makeMultiRowClient([
      { prompt_name: 'ilhap', version: 'v0.13', content: 'ACTIVE', status: 'active', canary_ratio: 0 },
    ]);
    const result = await loadPromptForUser(client as never, 'ilhap', 'user-1');
    expect(result.status).toBe('active');
    expect(result.version).toBe('v0.13');
  });

  it('canary 행만 있고 active 없으면 PROMPT_NOT_FOUND', async () => {
    const client = makeMultiRowClient([
      { prompt_name: 'ilhap', version: 'v0.14', content: 'CANARY', status: 'canary', canary_ratio: 0.05 },
    ]);
    await expect(loadPromptForUser(client as never, 'ilhap', 'user-1')).rejects.toThrow('PROMPT_NOT_FOUND');
  });

  it('canary_ratio=0 이면 항상 active 반환', async () => {
    const client = makeMultiRowClient([
      { prompt_name: 'ilhap', version: 'v0.13', content: 'ACTIVE', status: 'active', canary_ratio: 0 },
      { prompt_name: 'ilhap', version: 'v0.14', content: 'CANARY', status: 'canary', canary_ratio: 0 },
    ]);
    for (const uid of ['user-1', 'user-2', 'user-99', 'user-abcd']) {
      const result = await loadPromptForUser(client as never, 'ilhap', uid);
      expect(result.status).toBe('active');
    }
  });

  it('canary_ratio=1 이면 항상 canary 반환', async () => {
    const client = makeMultiRowClient([
      { prompt_name: 'ilhap', version: 'v0.13', content: 'ACTIVE', status: 'active' },
      { prompt_name: 'ilhap', version: 'v0.14', content: 'CANARY', status: 'canary', canary_ratio: 1 },
    ]);
    for (const uid of ['user-1', 'user-2', 'user-99']) {
      const result = await loadPromptForUser(client as never, 'ilhap', uid);
      expect(result.status).toBe('canary');
    }
  });

  it('1000 userId / canary_ratio=0.05 → 약 5% 가 canary, 나머지 active', async () => {
    const client = makeMultiRowClient([
      { prompt_name: 'ilhap', version: 'v0.13', content: 'ACTIVE', status: 'active' },
      { prompt_name: 'ilhap', version: 'v0.14', content: 'CANARY', status: 'canary', canary_ratio: 0.05 },
    ]);
    let canaryCount = 0;
    for (let i = 0; i < 1000; i++) {
      const result = await loadPromptForUser(client as never, 'ilhap', `user-${i}`);
      if (result.status === 'canary') canaryCount++;
    }
    expect(canaryCount).toBeGreaterThan(35);
    expect(canaryCount).toBeLessThan(65);
  });

  it('동일 userId 반복 호출 → 동일 결과 (deterministic)', async () => {
    const client = makeMultiRowClient([
      { prompt_name: 'ilhap', version: 'v0.13', content: 'ACTIVE', status: 'active' },
      { prompt_name: 'ilhap', version: 'v0.14', content: 'CANARY', status: 'canary', canary_ratio: 0.05 },
    ]);
    const a = await loadPromptForUser(client as never, 'ilhap', 'user-42');
    const b = await loadPromptForUser(client as never, 'ilhap', 'user-42');
    expect(a.version).toBe(b.version);
    expect(a.status).toBe(b.status);
  });

  it('미존재 prompt_name → PROMPT_NOT_FOUND', async () => {
    const client = makeMultiRowClient([]);
    await expect(loadPromptForUser(client as never, 'ilhap', 'user-1')).rejects.toThrow('PROMPT_NOT_FOUND');
  });

  it('Supabase error → throw', async () => {
    const errorClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(async () => ({ data: null, error: { message: 'connection refused' } })),
          })),
        })),
      })),
    };
    await expect(loadPromptForUser(errorClient as never, 'ilhap', 'user-1')).rejects.toThrow();
  });
});

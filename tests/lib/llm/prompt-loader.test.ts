import { describe, it, expect, vi } from 'vitest';
import { loadActivePrompt, MODE_TO_PROMPT_NAME } from '@/lib/llm/prompt-loader';
import type { Mode } from '@/types/mode';

interface FakePromptRow {
  prompt_name: string;
  version: string;
  content: string;
  status: 'active' | 'canary' | 'rolled_back';
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

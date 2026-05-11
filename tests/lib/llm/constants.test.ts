import { describe, it, expect } from 'vitest';
import { DEFAULT_LLM_MODEL } from '@/lib/llm/constants';
import type { LlmModel } from '@/types/hapcard';

describe('DEFAULT_LLM_MODEL', () => {
  it('값이 gpt-5o 이다', () => {
    expect(DEFAULT_LLM_MODEL).toBe('gpt-5o');
  });

  it('LlmModel 타입에 할당 가능하다', () => {
    // compile-time check — runtime 에서는 assignability 검증
    const _typed: LlmModel = DEFAULT_LLM_MODEL;
    expect(_typed).toBe('gpt-5o');
  });
});

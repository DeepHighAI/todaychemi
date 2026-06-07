import { describe, expect, it } from 'vitest';

import { selectLlmModel } from '@/lib/llm/model-router';
import type { LlmModel } from '@/types/hapcard';

describe('selectLlmModel', () => {
  it('케미카드는 gpt-5를 사용한다', () => {
    expect(selectLlmModel('hapcard')).toBe('gpt-5');
  });

  it('케미 다시 맞추기(replay)은 gpt-5를 사용한다', () => {
    expect(selectLlmModel('replay')).toBe('gpt-5');
  });

  it('홈의 오늘의 케미는 gpt-5를 사용한다 (G2 / Phase 3 C5: gpt-5-mini → gpt-5 격상)', () => {
    expect(selectLlmModel('today')).toBe('gpt-5');
  });

  it('딥 리포트 예약값은 gpt-5이다', () => {
    expect(selectLlmModel('deep-report')).toBe('gpt-5');
  });

  it('반환값은 DB llm_model 허용 타입과 일치한다', () => {
    const model: LlmModel = selectLlmModel('hapcard');
    expect(model).toBe('gpt-5');
  });
});

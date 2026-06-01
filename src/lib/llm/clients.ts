import OpenAI from 'openai';
import { ConfigError } from '@/lib/config-error';

// OpenAI SDK 클라이언트 팩토리.
// PII §5: API 호출 자체에는 PII 미전달 — payload는 callOpenAi() 가 검증.
export function createOpenAiClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ConfigError('Missing env: OPENAI_API_KEY');
  }
  const project = process.env.OPENAI_PROJECT_ID;
  if (process.env.NODE_ENV === 'production' && !project) {
    throw new ConfigError('Missing env: OPENAI_PROJECT_ID');
  }
  return new OpenAI({ apiKey, project: project || undefined, timeout: 60_000 });
}

// embeddings 만 필요한 경우 (RAG 쿼리용).
// builder 의 BuildHapcardDeps.embeddingsClient 형식과 일치.
export function createEmbeddingsClient(): OpenAI['embeddings'] {
  return createOpenAiClient().embeddings;
}

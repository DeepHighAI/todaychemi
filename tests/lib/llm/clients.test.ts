import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

// OpenAI 생성자를 mock — 실제 키 없이도 인스턴스화 검증 가능
const OpenAiCtor = vi.fn();
vi.mock('openai', () => ({
  default: OpenAiCtor,
}));

describe('createOpenAiClient', () => {
  beforeEach(() => {
    vi.resetModules();
    OpenAiCtor.mockClear();
    OpenAiCtor.mockImplementation(function (this: Record<string, unknown>, opts: { apiKey: string }) {
      this.apiKey = opts.apiKey;
      this.chat = { completions: { create: vi.fn() } };
      this.embeddings = { create: vi.fn() };
    });
    process.env.OPENAI_API_KEY = 'sk-test-key';
    process.env.OPENAI_PROJECT_ID = 'proj_test';
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...ORIGINAL_ENV };
  });

  it('OPENAI_API_KEY 로 OpenAI SDK 인스턴스 생성', async () => {
    const { createOpenAiClient } = await import('@/lib/llm/clients');
    createOpenAiClient();
    expect(OpenAiCtor).toHaveBeenCalledTimes(1);
    expect(OpenAiCtor.mock.calls[0][0]).toEqual({
      apiKey: 'sk-test-key',
      project: 'proj_test',
      timeout: 60_000,
    });
  });

  it('OPENAI_API_KEY 누락 시 ConfigError throw', async () => {
    delete process.env.OPENAI_API_KEY;
    const { createOpenAiClient } = await import('@/lib/llm/clients');
    expect(() => createOpenAiClient()).toThrow(/OPENAI_API_KEY/);
  });

  it('production에서 OPENAI_PROJECT_ID 누락 시 ConfigError throw', async () => {
    delete process.env.OPENAI_PROJECT_ID;
    vi.stubEnv('NODE_ENV', 'production');
    const { createOpenAiClient } = await import('@/lib/llm/clients');
    expect(() => createOpenAiClient()).toThrow(/OPENAI_PROJECT_ID/);
  });

  it('반환 객체는 chat.completions.create 와 embeddings.create 노출', async () => {
    const { createOpenAiClient } = await import('@/lib/llm/clients');
    const client = createOpenAiClient();
    expect(typeof client.chat.completions.create).toBe('function');
    expect(typeof client.embeddings.create).toBe('function');
  });

  it('legacy llm/openai export도 canonical factory를 사용해 production project를 강제', async () => {
    delete process.env.OPENAI_PROJECT_ID;
    vi.stubEnv('NODE_ENV', 'production');
    const { createOpenAiClient } = await import('@/lib/llm/openai');
    expect(() => createOpenAiClient()).toThrow(/OPENAI_PROJECT_ID/);
  });
});

describe('createEmbeddingsClient', () => {
  beforeEach(() => {
    vi.resetModules();
    OpenAiCtor.mockClear();
    OpenAiCtor.mockImplementation(function (this: Record<string, unknown>) {
      this.embeddings = { create: vi.fn() };
      this.chat = { completions: { create: vi.fn() } };
    });
    process.env.OPENAI_API_KEY = 'sk-test-key';
    process.env.OPENAI_PROJECT_ID = 'proj_test';
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...ORIGINAL_ENV };
  });

  it('embeddings 클라이언트 (.create 노출)를 반환', async () => {
    const { createEmbeddingsClient } = await import('@/lib/llm/clients');
    const embeddings = createEmbeddingsClient();
    expect(typeof embeddings.create).toBe('function');
  });

  it('OPENAI_API_KEY 누락 시 ConfigError throw', async () => {
    delete process.env.OPENAI_API_KEY;
    const { createEmbeddingsClient } = await import('@/lib/llm/clients');
    expect(() => createEmbeddingsClient()).toThrow(/OPENAI_API_KEY/);
  });
});

import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { loadPromptFiles, runSeed, type PromptRow } from '../../scripts/seed-prompts';

const EXPECTED_NAMES = new Set([
  'ilhap', 'chinguhap', 'donhap', 'cheothap', 'sseomhap', 'oraehap',
]);

describe('loadPromptFiles', () => {
  const dir = join(process.cwd(), 'prompts', 'system');

  it('returns 6 rows from prompts/system', () => {
    const rows = loadPromptFiles(dir);
    expect(rows).toHaveLength(6);
  });

  it('each row has a valid prompt_name', () => {
    const rows = loadPromptFiles(dir);
    for (const row of rows) {
      expect(EXPECTED_NAMES.has(row.prompt_name), `unexpected: ${row.prompt_name}`).toBe(true);
    }
  });

  it('each row has version v0.13', () => {
    const rows = loadPromptFiles(dir);
    for (const row of rows) {
      expect(row.version, `${row.prompt_name} version`).toBe('v0.13');
    }
  });

  it('each row requires newline-separated main_text and plain-language user-facing fields', () => {
    const rows = loadPromptFiles(dir);
    for (const row of rows) {
      expect(row.content, `${row.prompt_name} main_text newline rule`).toContain('JSON 문자열 안에서 `\\n`으로 줄바꿈');
      expect(row.content, `${row.prompt_name} plain-language rule`).toContain('Plain-language v0.12');
      expect(row.content, `${row.prompt_name} action role split rule`).toContain('Action role split v0.12');
      expect(row.content, `${row.prompt_name} ohaeng interpretation field`).toContain('"ohaeng_interpretation"');
      expect(row.content, `${row.prompt_name} ohaeng interpretation rule`).toContain('`ohaeng_interpretation`은 **반드시 출력**');
      expect(row.content, `${row.prompt_name} card actions rule`).toContain('actions[1~3]`은 `actions[0]`을 반복하지 말고');
      expect(row.content, `${row.prompt_name} four actions rule`).toMatch(
        /`actions`(?:는 \*\*반드시 4개\*\*|: 반드시 4개)/u,
      );
      expect(row.content, `${row.prompt_name} technical-term rewrite examples`).toContain('`일간`→`타고난 중심 기질`');
      expect(row.content, `${row.prompt_name} daily flow rule`).toContain('Daily relationship flow v0.13');
      expect(row.content, `${row.prompt_name} target date context`).toContain('time_context.target_date');
    }
  });

  it('each row has status active', () => {
    const rows = loadPromptFiles(dir);
    for (const row of rows) {
      expect(row.status).toBe('active');
    }
  });

  it('each row content is non-empty string', () => {
    const rows = loadPromptFiles(dir);
    for (const row of rows) {
      expect(typeof row.content).toBe('string');
      expect(row.content.length).toBeGreaterThan(0);
    }
  });
});

describe('runSeed', () => {
  it('calls archive-then-upsert with correct args', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockIn = vi.fn().mockReturnValue({ eq: mockEq });
    const mockUpdate = vi.fn().mockReturnValue({ in: mockIn });
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const tableApi = { upsert: mockUpsert, update: mockUpdate };
    const mockFrom = vi.fn().mockReturnValue(tableApi);
    const fakeClient = { from: mockFrom } as unknown as Parameters<typeof runSeed>[0];

    const rows: PromptRow[] = [
      { prompt_name: 'ilhap', version: 'v0.5', content: 'test', status: 'active' },
    ];

    const result = await runSeed(fakeClient, rows);

    expect(mockFrom).toHaveBeenCalledWith('prompt_versions');
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'rolled_back' });
    expect(mockIn).toHaveBeenCalledWith('prompt_name', ['ilhap']);
    expect(mockEq).toHaveBeenCalledWith('status', 'active');
    expect(mockUpsert).toHaveBeenCalledWith(rows, { onConflict: 'prompt_name,version' });
    expect(result.inserted).toBe(1);
  });

  it('throws when archive step returns an error', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: { message: 'archive error' } });
    const mockIn = vi.fn().mockReturnValue({ eq: mockEq });
    const mockUpdate = vi.fn().mockReturnValue({ in: mockIn });
    const fakeClient = {
      from: () => ({ update: mockUpdate }),
    } as unknown as Parameters<typeof runSeed>[0];

    await expect(runSeed(fakeClient, [])).rejects.toMatchObject({ message: 'archive error' });
  });

  it('throws when upsert step returns an error', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockIn = vi.fn().mockReturnValue({ eq: mockEq });
    const mockUpdate = vi.fn().mockReturnValue({ in: mockIn });
    const mockUpsert = vi.fn().mockResolvedValue({ error: { message: 'db error' } });
    const fakeClient = {
      from: () => ({ upsert: mockUpsert, update: mockUpdate }),
    } as unknown as Parameters<typeof runSeed>[0];

    await expect(runSeed(fakeClient, [])).rejects.toMatchObject({ message: 'db error' });
  });
});

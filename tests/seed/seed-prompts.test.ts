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

  it('each row has version v0.3', () => {
    const rows = loadPromptFiles(dir);
    for (const row of rows) {
      expect(row.version, `${row.prompt_name} version`).toBe('v0.3');
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
  it('calls upsert with the rows and correct onConflict option', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const mockFrom = vi.fn().mockReturnValue({ upsert: mockUpsert });
    const fakeClient = { from: mockFrom } as unknown as Parameters<typeof runSeed>[0];

    const rows: PromptRow[] = [
      { prompt_name: 'ilhap', version: 'v0.2', content: 'test', status: 'active' },
    ];

    const result = await runSeed(fakeClient, rows);

    expect(mockFrom).toHaveBeenCalledWith('prompt_versions');
    expect(mockUpsert).toHaveBeenCalledWith(rows, { onConflict: 'prompt_name,version' });
    expect(result.inserted).toBe(1);
  });

  it('throws when supabase returns an error', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: { message: 'db error' } });
    const fakeClient = {
      from: () => ({ upsert: mockUpsert }),
    } as unknown as Parameters<typeof runSeed>[0];

    await expect(runSeed(fakeClient, [])).rejects.toMatchObject({ message: 'db error' });
  });
});

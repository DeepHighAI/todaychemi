import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { loadPromptFiles, runSeed, HAPCARD_MODE_NAMES, OTHER_VALID_NAMES, type PromptRow } from '../../scripts/seed-prompts';

const EXPECTED_NAMES = new Set([...HAPCARD_MODE_NAMES, ...OTHER_VALID_NAMES]);

describe('loadPromptFiles', () => {
  const dir = join(process.cwd(), 'prompts', 'system');

  // Task 2 (ADR-008): 8 active (6 hapcard + today_with_relation + daily_hap) + 7 canary (active 중 daily_hap 제외)
  it('returns 15 rows (8 active + 7 canary)', () => {
    const rows = loadPromptFiles(dir);
    expect(rows).toHaveLength(15);
  });

  it('each row has a valid prompt_name', () => {
    const rows = loadPromptFiles(dir);
    for (const row of rows) {
      expect(EXPECTED_NAMES.has(row.prompt_name), `unexpected: ${row.prompt_name}`).toBe(true);
    }
  });

  it('active: 6모드 v0.15 + today_with_relation v0.3 + daily_hap v0.4', () => {
    const active = loadPromptFiles(dir).filter((r) => r.status === 'active');
    expect(active).toHaveLength(8);
    for (const row of active) {
      if (HAPCARD_MODE_NAMES.has(row.prompt_name)) {
        expect(row.version, `${row.prompt_name} active version`).toBe('v0.15');
      } else if (row.prompt_name === 'today_with_relation') {
        expect(row.version).toBe('v0.3');
      } else if (row.prompt_name === 'daily_hap') {
        expect(row.version).toBe('v0.4');
      }
    }
  });

  it('canary: 6모드 v0.16 + today_with_relation v0.4 (daily_hap canary 없음)', () => {
    const canary = loadPromptFiles(dir).filter((r) => r.status === 'canary');
    expect(canary).toHaveLength(7);
    for (const row of canary) {
      expect(row.canary_ratio).toBe(0.05);
      if (HAPCARD_MODE_NAMES.has(row.prompt_name)) {
        expect(row.version, `${row.prompt_name} canary version`).toBe('v0.16');
      } else if (row.prompt_name === 'today_with_relation') {
        expect(row.version).toBe('v0.4');
      }
    }
    // daily_hap 은 canary 시드 없음
    expect(canary.find((r) => r.prompt_name === 'daily_hap')).toBeUndefined();
  });

  // P3 (2026-06-11): derived·cross_analysis 입력 문서화 + 환각 가드 content-lock
  it('전 row: derived 가이드 + 환각 가드 조항 포함', () => {
    const rows = loadPromptFiles(dir);
    for (const row of rows) {
      expect(row.content, `${row.prompt_name} derived doc`).toContain('derived');
      expect(row.content, `${row.prompt_name} hallucination guard`).toContain(
        '제공 필드 외 단정 금지',
      );
    }
  });

  it('관계 프롬프트(6모드 + today_with_relation): cross_analysis 입력 문서화', () => {
    const rows = loadPromptFiles(dir).filter(
      (r) => HAPCARD_MODE_NAMES.has(r.prompt_name) || r.prompt_name === 'today_with_relation',
    );
    expect(rows.length).toBe(14); // (6+1) × active+canary
    for (const row of rows) {
      expect(row.content, `${row.prompt_name} cross_analysis doc`).toContain('cross_analysis');
    }
  });

  it('canary row 본문은 active row 본문과 동일 (본문 변경 없는 routing 인프라 검증)', () => {
    const rows = loadPromptFiles(dir);
    const grouped = new Map<string, { active?: string; canary?: string }>();
    for (const row of rows) {
      const slot = grouped.get(row.prompt_name) ?? {};
      if (row.status === 'active') slot.active = row.content;
      if (row.status === 'canary') slot.canary = row.content;
      grouped.set(row.prompt_name, slot);
    }
    for (const [name, { active, canary }] of grouped) {
      if (active && canary) {
        expect(canary, `${name} canary content matches active`).toBe(active);
      }
    }
  });

  it('hapcard modes only: newline-separated main_text + plain-language fields', () => {
    const rows = loadPromptFiles(dir).filter(
      (r) => HAPCARD_MODE_NAMES.has(r.prompt_name) && r.status === 'active',
    );
    expect(rows.length).toBe(6);
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

  it('each row has status active 또는 canary', () => {
    const rows = loadPromptFiles(dir);
    for (const row of rows) {
      expect(['active', 'canary']).toContain(row.status);
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
  it('calls archive-then-upsert with correct args (active + canary 둘 다 archive)', async () => {
    // Task 2: archive 가 .in('prompt_name', ...).in('status', ['active','canary']) 2단 chain.
    const mockStatusIn = vi.fn().mockResolvedValue({ error: null });
    const mockNameIn = vi.fn().mockReturnValue({ in: mockStatusIn });
    const mockUpdate = vi.fn().mockReturnValue({ in: mockNameIn });
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
    expect(mockNameIn).toHaveBeenCalledWith('prompt_name', ['ilhap']);
    expect(mockStatusIn).toHaveBeenCalledWith('status', ['active', 'canary']);
    expect(mockUpsert).toHaveBeenCalledWith(rows, { onConflict: 'prompt_name,version' });
    expect(result.inserted).toBe(1);
  });

  it('throws when archive step returns an error', async () => {
    const mockStatusIn = vi.fn().mockResolvedValue({ error: { message: 'archive error' } });
    const mockNameIn = vi.fn().mockReturnValue({ in: mockStatusIn });
    const mockUpdate = vi.fn().mockReturnValue({ in: mockNameIn });
    const fakeClient = {
      from: () => ({ update: mockUpdate }),
    } as unknown as Parameters<typeof runSeed>[0];

    await expect(runSeed(fakeClient, [])).rejects.toMatchObject({ message: 'archive error' });
  });

  it('throws when upsert step returns an error', async () => {
    const mockStatusIn = vi.fn().mockResolvedValue({ error: null });
    const mockNameIn = vi.fn().mockReturnValue({ in: mockStatusIn });
    const mockUpdate = vi.fn().mockReturnValue({ in: mockNameIn });
    const mockUpsert = vi.fn().mockResolvedValue({ error: { message: 'db error' } });
    const fakeClient = {
      from: () => ({ upsert: mockUpsert, update: mockUpdate }),
    } as unknown as Parameters<typeof runSeed>[0];

    await expect(runSeed(fakeClient, [])).rejects.toMatchObject({ message: 'db error' });
  });
});

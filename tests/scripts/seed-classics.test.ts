import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  loadClassicYamls,
  embedClassics,
  runSeedClassics,
  type ClassicYamlInput,
  type ClassicRow,
} from '../../scripts/seed-classics';

// 합법적 YAML 1건 — 모든 필수 + 선택 필드 포함
const VALID_YAML = `asset_id: classic_jcs_001
source_title: "적천수 (滴天髓)"
source_chapter: "通神頌"
original_text: "官多者身弱"
original_reading: "관다자신약"
modern_translation: "관성이 많아 자신의 힘이 약하다"
topic_tags:
  - official_overload
  - weak_daymaster
version: v1.0
review_status: approved_ai_pending_human
`;

describe('loadClassicYamls', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'classics-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('단일 YAML 파일을 ClassicYamlInput 으로 파싱', () => {
    writeFileSync(join(tempDir, 'jcs_001.yaml'), VALID_YAML);

    const rows = loadClassicYamls(tempDir);

    expect(rows).toHaveLength(1);
    expect(rows[0].asset_id).toBe('classic_jcs_001');
    expect(rows[0].source_title).toBe('적천수 (滴天髓)');
    expect(rows[0].source_chapter).toBe('通神頌');
    expect(rows[0].original_text).toBe('官多者身弱');
    expect(rows[0].original_reading).toBe('관다자신약');
    expect(rows[0].modern_translation).toBe('관성이 많아 자신의 힘이 약하다');
    expect(rows[0].topic_tags).toEqual(['official_overload', 'weak_daymaster']);
    expect(rows[0].version).toBe('v1.0');
    expect(rows[0].review_status).toBe('approved_ai_pending_human');
  });

  it('여러 YAML 파일을 파일명 사전순으로 읽음', () => {
    const y1 = VALID_YAML.replace('classic_jcs_001', 'classic_a');
    const y2 = VALID_YAML.replace('classic_jcs_001', 'classic_b');
    const y3 = VALID_YAML.replace('classic_jcs_001', 'classic_c');
    writeFileSync(join(tempDir, 'b.yaml'), y2);
    writeFileSync(join(tempDir, 'a.yaml'), y1);
    writeFileSync(join(tempDir, 'c.yaml'), y3);

    const rows = loadClassicYamls(tempDir);

    expect(rows.map((r) => r.asset_id)).toEqual([
      'classic_a',
      'classic_b',
      'classic_c',
    ]);
  });

  it('.yml 확장자도 허용', () => {
    writeFileSync(join(tempDir, 'sample.yml'), VALID_YAML);
    const rows = loadClassicYamls(tempDir);
    expect(rows).toHaveLength(1);
  });

  it('.md 등 yaml 이 아닌 파일은 무시', () => {
    writeFileSync(join(tempDir, 'sample.yaml'), VALID_YAML);
    writeFileSync(join(tempDir, 'README.md'), '# notes');
    writeFileSync(join(tempDir, 'noise.txt'), 'noise');

    const rows = loadClassicYamls(tempDir);
    expect(rows).toHaveLength(1);
  });

  it('필수 필드 누락 시 throw (asset_id 없음)', () => {
    const bad = VALID_YAML.replace('asset_id: classic_jcs_001\n', '');
    writeFileSync(join(tempDir, 'bad.yaml'), bad);
    expect(() => loadClassicYamls(tempDir)).toThrow(/asset_id/);
  });

  it('review_status 가 enum 외 값이면 throw', () => {
    const bad = VALID_YAML.replace(
      'review_status: approved_ai_pending_human',
      'review_status: invalid_status',
    );
    writeFileSync(join(tempDir, 'bad.yaml'), bad);
    expect(() => loadClassicYamls(tempDir)).toThrow(/review_status/);
  });

  it('topic_tags 누락 시 빈 배열 default', () => {
    const minimal = `asset_id: classic_min
source_title: "T"
source_chapter: "C"
original_text: "O"
modern_translation: "M"
version: v1.0
review_status: draft
`;
    writeFileSync(join(tempDir, 'minimal.yaml'), minimal);
    const rows = loadClassicYamls(tempDir);
    expect(rows[0].topic_tags).toEqual([]);
  });

  it('디렉토리 미존재 시 빈 배열 반환 (G4 YAML 미작성 시나리오)', () => {
    const nonexistent = join(tmpdir(), `classics-missing-${Date.now()}`);
    expect(loadClassicYamls(nonexistent)).toEqual([]);
  });

  it('original_reading 은 선택 — 없으면 null', () => {
    const noReading = `asset_id: classic_noreading
source_title: "T"
source_chapter: "C"
original_text: "O"
modern_translation: "M"
topic_tags: []
version: v1.0
review_status: draft
`;
    writeFileSync(join(tempDir, 'nr.yaml'), noReading);
    const rows = loadClassicYamls(tempDir);
    expect(rows[0].original_reading).toBeNull();
  });
});

describe('embedClassics', () => {
  function makeInput(overrides: Partial<ClassicYamlInput> = {}): ClassicYamlInput {
    return {
      asset_id: 'classic_test_001',
      source_title: '적천수',
      source_chapter: '通神頌',
      original_text: '官多者身弱',
      original_reading: '관다자신약',
      modern_translation: '관성이 많아 자신의 힘이 약하다',
      topic_tags: ['official_overload'],
      version: 'v1.0',
      review_status: 'approved_ai_pending_human',
      ...overrides,
    };
  }

  it('각 input 마다 embeddings.create 1회 호출', async () => {
    const create = vi.fn().mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0) }],
    });
    const inputs = [
      makeInput({ asset_id: 'a' }),
      makeInput({ asset_id: 'b' }),
      makeInput({ asset_id: 'c' }),
    ];

    await embedClassics(inputs, { embeddings: { create } });

    expect(create).toHaveBeenCalledTimes(3);
  });

  it('embedding 입력 텍스트 = original_text + modern_translation', async () => {
    const create = vi.fn().mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0) }],
    });
    const input = makeInput({
      original_text: '官多者身弱',
      modern_translation: '관성이 많아 자신의 힘이 약하다',
    });

    await embedClassics([input], { embeddings: { create } });

    const call = create.mock.calls[0][0];
    expect(call.input).toContain('官多者身弱');
    expect(call.input).toContain('관성이 많아 자신의 힘이 약하다');
  });

  it('text-embedding-3-small 모델 사용', async () => {
    const create = vi.fn().mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0) }],
    });
    await embedClassics([makeInput()], { embeddings: { create } });
    expect(create.mock.calls[0][0].model).toBe('text-embedding-3-small');
  });

  it('반환 ClassicRow 에 embedding 부착', async () => {
    const fakeVec = new Array(1536).fill(0.5);
    const create = vi.fn().mockResolvedValue({ data: [{ embedding: fakeVec }] });
    const input = makeInput();

    const rows = await embedClassics([input], { embeddings: { create } });

    expect(rows).toHaveLength(1);
    expect(rows[0].embedding).toEqual(fakeVec);
    expect(rows[0].asset_id).toBe(input.asset_id);
  });

  it('embeddings.create 실패 시 propagate', async () => {
    const create = vi.fn().mockRejectedValue(new Error('rate limit'));
    await expect(
      embedClassics([makeInput()], { embeddings: { create } }),
    ).rejects.toThrow(/rate limit/);
  });
});

describe('runSeedClassics', () => {
  function makeRow(): ClassicRow {
    return {
      asset_id: 'classic_test_001',
      source_title: '적천수',
      source_chapter: '通神頌',
      original_text: '官多者身弱',
      original_reading: '관다자신약',
      modern_translation: '관성이 많아 자신의 힘이 약하다',
      topic_tags: ['official_overload'],
      version: 'v1.0',
      review_status: 'approved_ai_pending_human',
      embedding: new Array(1536).fill(0.1),
    };
  }

  it('asset_id 충돌 시 upsert (onConflict=asset_id)', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ upsert });
    const client = { from } as never;

    const rows = [makeRow()];
    await runSeedClassics(client, rows);

    expect(from).toHaveBeenCalledWith('classics');
    expect(upsert).toHaveBeenCalledTimes(1);
    const [arg, opts] = upsert.mock.calls[0];
    expect(arg).toEqual(rows);
    expect(opts).toEqual({ onConflict: 'asset_id' });
  });

  it('inserted = rows.length 반환', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ upsert });
    const client = { from } as never;

    const result = await runSeedClassics(client, [makeRow(), makeRow()]);

    expect(result.inserted).toBe(2);
  });

  it('supabase error 면 throw', async () => {
    const upsert = vi.fn().mockResolvedValue({
      error: { message: 'rls denied' },
    });
    const from = vi.fn().mockReturnValue({ upsert });
    const client = { from } as never;

    await expect(runSeedClassics(client, [makeRow()])).rejects.toThrow(
      /rls denied/,
    );
  });
});

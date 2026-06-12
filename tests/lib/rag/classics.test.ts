import { describe, it, expect, vi } from 'vitest';
import { retrieveClassics } from '@/lib/rag/classics';

const DIM_1536 = Array.from({ length: 1536 }, () => 0.1);

interface MockRow {
  asset_id: string;
  source_title: string;
  source_chapter: string;
  original_text: string;
  original_reading: string | null;
  modern_translation: string;
  topic_tags: string[];
  version: string;
  review_status: string;
  // distance is cosine distance (lower = closer)
  _distance: number;
}

function makeRow(
  id: string,
  distance: number,
  status = 'approved_ai_pending_human',
  topicTags: string[] = ['합'],
): MockRow {
  return {
    asset_id: id,
    source_title: '연해자평',
    source_chapter: '권1',
    original_text: `原文 ${id}`,
    original_reading: null,
    modern_translation: `번역 ${id}`,
    topic_tags: topicTags,
    version: 'v1',
    review_status: status,
    _distance: distance,
  };
}

const APPROVED = [
  'approved_ai_pending_human',
  'approved_ai_and_crowd',
  'approved_ai_crowd_and_beta',
];

// similarity = 1 - distance. lexical 조회(from().select().overlaps().in())도 지원
function makeMockClient(rows: MockRow[]) {
  const filteredRows = rows.filter((r) => APPROVED.includes(r.review_status));
  const sorted = [...filteredRows].sort((a, b) => a._distance - b._distance);

  return {
    rpc: vi.fn((fn: string, params: Record<string, unknown>) => {
      const limit = (params.match_count as number) ?? 5;
      const data = sorted.slice(0, limit).map((r) => ({
        asset_id: r.asset_id,
        source_title: r.source_title,
        source_chapter: r.source_chapter,
        original_text: r.original_text,
        original_reading: r.original_reading,
        modern_translation: r.modern_translation,
        topic_tags: r.topic_tags,
        similarity: parseFloat((1 - r._distance).toFixed(4)),
      }));
      return { data, error: null };
    }),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        overlaps: vi.fn((_col: string, tags: string[]) => ({
          in: vi.fn(() => {
            const data = rows
              .filter(
                (r) =>
                  APPROVED.includes(r.review_status) &&
                  r.topic_tags.some((t) => tags.includes(t)),
              )
              .map((r) => ({
                asset_id: r.asset_id,
                source_title: r.source_title,
                source_chapter: r.source_chapter,
                original_text: r.original_text,
                original_reading: r.original_reading,
                modern_translation: r.modern_translation,
                topic_tags: r.topic_tags,
              }));
            return { data, error: null };
          }),
        })),
      })),
    })),
  };
}

describe('retrieveClassics — cosine threshold 분류', () => {
  it('required 2건 + optional 1건 + drop 1건 = 3건 반환', async () => {
    const rows = [
      makeRow('C001', 0.15), // sim=0.85 → required
      makeRow('C002', 0.22), // sim=0.78 → required
      makeRow('C003', 0.35), // sim=0.65 → optional
      makeRow('C004', 0.45), // sim=0.55 → drop
    ];
    const client = makeMockClient(rows);
    const hits = await retrieveClassics(client as never, DIM_1536);
    expect(hits).toHaveLength(3);
    expect(hits[0].tier).toBe('required');
    expect(hits[1].tier).toBe('required');
    expect(hits[2].tier).toBe('optional');
  });

  it('모두 0.50 미만 → 빈 배열', async () => {
    const rows = [makeRow('C001', 0.60)]; // sim=0.40
    const client = makeMockClient(rows);
    const hits = await retrieveClassics(client as never, DIM_1536);
    expect(hits).toHaveLength(0);
  });

  it('topK=2 → 상위 2건만', async () => {
    const rows = [
      makeRow('C001', 0.10), // sim=0.90
      makeRow('C002', 0.20), // sim=0.80
      makeRow('C003', 0.22), // sim=0.78
    ];
    const client = makeMockClient(rows);
    const hits = await retrieveClassics(client as never, DIM_1536, { topK: 2 });
    expect(hits).toHaveLength(2);
  });

  it('review_status=draft 제외', async () => {
    const rows = [
      makeRow('C001', 0.10, 'draft'), // 제외
      makeRow('C002', 0.20, 'approved_ai_pending_human'), // 포함
    ];
    const client = makeMockClient(rows);
    const hits = await retrieveClassics(client as never, DIM_1536);
    expect(hits).toHaveLength(1);
    expect(hits[0].asset_id).toBe('C002');
  });

  it('review_status=deprecated 제외', async () => {
    const rows = [makeRow('C001', 0.10, 'deprecated')];
    const client = makeMockClient(rows);
    const hits = await retrieveClassics(client as never, DIM_1536);
    expect(hits).toHaveLength(0);
  });

  it('similarity desc 정렬 (0.85 → 0.78 → 0.65)', async () => {
    const rows = [
      makeRow('C003', 0.35), // sim=0.65
      makeRow('C001', 0.15), // sim=0.85
      makeRow('C002', 0.22), // sim=0.78
    ];
    const client = makeMockClient(rows);
    const hits = await retrieveClassics(client as never, DIM_1536);
    expect(hits[0].similarity).toBeGreaterThan(hits[1].similarity);
    expect(hits[1].similarity).toBeGreaterThan(hits[2].similarity);
  });

  it('queryEmbedding.length !== 1536 → EMBEDDING_DIM_MISMATCH', async () => {
    const client = makeMockClient([]);
    await expect(retrieveClassics(client as never, [0.1, 0.2])).rejects.toThrow(
      'EMBEDDING_DIM_MISMATCH',
    );
  });

  it('DB 에러 → re-throw', async () => {
    const client = {
      rpc: vi.fn(() => ({ data: null, error: { message: 'connection refused' } })),
    };
    await expect(retrieveClassics(client as never, DIM_1536)).rejects.toThrow('connection refused');
  });

  it('threshold 기본값: required=0.75 / optional=0.60 경계', async () => {
    const rows = [
      makeRow('A', 0.25),  // sim=0.75 → required (경계)
      makeRow('B', 0.40),  // sim=0.60 → optional (경계)
      makeRow('C', 0.41),  // sim=0.59 → drop
    ];
    const client = makeMockClient(rows);
    const hits = await retrieveClassics(client as never, DIM_1536);
    expect(hits).toHaveLength(2);
    expect(hits[0].tier).toBe('required');
    expect(hits[1].tier).toBe('optional');
  });
});

// ISSUE-001 (§1.1 결정 ③): topic_tags lexical 하이브리드 —
// 임베딩 유사도가 임계 미달이어도 태그 겹침 ≥2 면 채택
describe('retrieveClassics — queryTags lexical 하이브리드', () => {
  it('유사도 임계 미달 + 태그 겹침 2 (mode+개념) → lexical 채택', async () => {
    const rows = [
      makeRow('L1', 0.65, undefined, ['일합', 'daymaster_strength']), // sim=0.35 — 기존엔 drop
    ];
    const client = makeMockClient(rows);
    const hits = await retrieveClassics(client as never, DIM_1536, {
      queryTags: ['일합', 'daymaster_strength', 'useful_god'],
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].asset_id).toBe('L1');
  });

  it('태그 겹침 1 (mode만) → lexical 미채택 (관련성 부족)', async () => {
    const rows = [makeRow('L1', 0.65, undefined, ['일합', 'seasonal_balance'])];
    const client = makeMockClient(rows);
    const hits = await retrieveClassics(client as never, DIM_1536, {
      queryTags: ['일합', 'daymaster_strength'],
    });
    expect(hits).toHaveLength(0);
  });

  it('queryTags 미전달 → 기존 임베딩 전용 동작 그대로 (회귀 0)', async () => {
    const rows = [makeRow('L1', 0.65, undefined, ['일합', 'daymaster_strength'])]; // sim=0.35
    const client = makeMockClient(rows);
    const hits = await retrieveClassics(client as never, DIM_1536);
    expect(hits).toHaveLength(0);
  });

  it('정렬: 태그 겹침 내림차순 → 동률은 유사도 내림차순 → asset_id 오름차순', async () => {
    const rows = [
      makeRow('B2', 0.70, undefined, ['일합', 'daymaster_strength']),               // overlap=2, sim=0.30
      makeRow('A3', 0.75, undefined, ['일합', 'daymaster_strength', 'useful_god']), // overlap=3, sim=0.25
      makeRow('C2', 0.60, undefined, ['일합', 'useful_god']),                       // overlap=2, sim=0.40
      makeRow('D2', 0.60, undefined, ['일합', 'hidden_stems']),                     // overlap=2, sim=0.40 — tie
    ];
    const client = makeMockClient(rows);
    const hits = await retrieveClassics(client as never, DIM_1536, {
      queryTags: ['일합', 'daymaster_strength', 'useful_god', 'hidden_stems'],
    });
    expect(hits.map((h) => h.asset_id)).toEqual(['A3', 'C2', 'D2', 'B2']);
  });

  it('임베딩 임계 통과 hit 과 lexical hit 합집합 (중복 1회)', async () => {
    const rows = [
      makeRow('E1', 0.20, undefined, ['오래합']),                       // sim=0.80 — 임베딩 required
      makeRow('L1', 0.65, undefined, ['일합', 'daymaster_strength']),   // lexical only
      makeRow('B1', 0.15, undefined, ['일합', 'daymaster_strength']),   // sim=0.85 + lexical — 중복 후보
    ];
    const client = makeMockClient(rows);
    const hits = await retrieveClassics(client as never, DIM_1536, {
      queryTags: ['일합', 'daymaster_strength'],
    });
    const ids = hits.map((h) => h.asset_id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    expect(ids).toContain('E1');
    expect(ids).toContain('L1');
    expect(ids).toContain('B1');
  });

  it('topK 가 합집합에도 적용된다', async () => {
    const rows = [
      makeRow('L1', 0.65, undefined, ['일합', 'a']),
      makeRow('L2', 0.66, undefined, ['일합', 'a']),
      makeRow('L3', 0.67, undefined, ['일합', 'a']),
    ];
    const client = makeMockClient(rows);
    const hits = await retrieveClassics(client as never, DIM_1536, {
      queryTags: ['일합', 'a'],
      topK: 2,
    });
    expect(hits).toHaveLength(2);
  });

  it('lexical hit tier: 유사도 0.75 미만이면 optional', async () => {
    const rows = [makeRow('L1', 0.65, undefined, ['일합', 'daymaster_strength'])];
    const client = makeMockClient(rows);
    const hits = await retrieveClassics(client as never, DIM_1536, {
      queryTags: ['일합', 'daymaster_strength'],
    });
    expect(hits[0].tier).toBe('optional');
  });

  it('lexical 조회 DB 에러 → re-throw', async () => {
    const client = {
      rpc: vi.fn(() => ({ data: [], error: null })),
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          overlaps: vi.fn(() => ({
            in: vi.fn(() => ({ data: null, error: { message: 'lexical query failed' } })),
          })),
        })),
      })),
    };
    await expect(
      retrieveClassics(client as never, DIM_1536, { queryTags: ['일합', 'a'] }),
    ).rejects.toThrow('lexical query failed');
  });

  it('queryTags 빈 배열 → 임베딩 전용 동작 (lexical 조회 생략)', async () => {
    const rows = [makeRow('L1', 0.65, undefined, ['일합', 'a'])];
    const client = makeMockClient(rows);
    const hits = await retrieveClassics(client as never, DIM_1536, { queryTags: [] });
    expect(hits).toHaveLength(0);
    expect(client.from).not.toHaveBeenCalled();
  });
});

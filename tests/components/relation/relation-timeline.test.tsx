// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { RelationTimeline } from '@/components/relation/relation-timeline';
import type { RelationTimelineResponse } from '@/types/relation';

const REL_ID = 'rel-uuid-001';

// API 응답은 이미 최신순(desc) + 등록 이벤트 마지막 (라우트 계약)
const FULL_DATA: RelationTimelineResponse = {
  events: [
    { type: 'hapcard', occurred_at: '2026-06-01T09:00:00Z', mode: '썸합' },
    { type: 'replay', occurred_at: '2026-05-20T09:00:00Z', mode: '친구합' },
    { type: 'hapcard', occurred_at: '2026-05-10T09:00:00Z', mode: '친구합' },
    { type: 'registered', occurred_at: '2026-05-01T00:00:00Z', mode: null },
  ],
};

const REGISTERED_ONLY: RelationTimelineResponse = {
  events: [
    { type: 'registered', occurred_at: '2026-05-01T00:00:00Z', mode: null },
  ],
};

function mockFetchOk(data: RelationTimelineResponse) {
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => data,
  } as Response);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RelationTimeline — loading', () => {
  it('fetch 진행 중 → skeleton 표시', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => {}));
    renderWithProviders(<RelationTimeline relationId={REL_ID} />);
    expect(await screen.findByTestId('relation-timeline-skeleton')).toBeInTheDocument();
  });
});

describe('RelationTimeline — data', () => {
  it('이벤트 4건을 응답 순서(최신순)대로 렌더', async () => {
    mockFetchOk(FULL_DATA);

    renderWithProviders(<RelationTimeline relationId={REL_ID} />);

    await waitFor(() =>
      expect(screen.getByTestId('relation-timeline')).toBeInTheDocument(),
    );

    const rows = screen.getAllByTestId('relation-timeline-event');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent('케미카드 · 썸 관계');
    expect(rows[1]).toHaveTextContent('케미 다시 맞추기 · 친구 관계');
    expect(rows[2]).toHaveTextContent('케미카드 · 친구 관계');
    expect(rows[3]).toHaveTextContent('인연 등록');
  });

  it('occurred_at 을 KST 날짜(YYYY.MM.DD)로 표기 — UTC→KST 날짜 경계 포함', async () => {
    mockFetchOk({
      events: [
        // UTC 5/31 16:00 = KST 6/1 01:00 → 2026.06.01 로 표기되어야 함
        { type: 'hapcard', occurred_at: '2026-05-31T16:00:00Z', mode: '친구합' },
        { type: 'registered', occurred_at: '2026-05-01T00:00:00Z', mode: null },
      ],
    });

    renderWithProviders(<RelationTimeline relationId={REL_ID} />);

    await waitFor(() =>
      expect(screen.getByTestId('relation-timeline')).toBeInTheDocument(),
    );

    const rows = screen.getAllByTestId('relation-timeline-event');
    expect(rows[0]).toHaveTextContent('2026.06.01');
    expect(rows[1]).toHaveTextContent('2026.05.01');
  });

  it('등록 이벤트만 있어도 타임라인 렌더 (mode 라벨 없음)', async () => {
    mockFetchOk(REGISTERED_ONLY);

    renderWithProviders(<RelationTimeline relationId={REL_ID} />);

    await waitFor(() =>
      expect(screen.getByTestId('relation-timeline')).toBeInTheDocument(),
    );

    const rows = screen.getAllByTestId('relation-timeline-event');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('인연 등록');
    expect(rows[0].textContent).not.toContain('·');
  });

  it('v1 표시 전용 — 이벤트 내부에 링크·버튼 없음 (§1.1 2026-06-13)', async () => {
    mockFetchOk(FULL_DATA);

    renderWithProviders(<RelationTimeline relationId={REL_ID} />);

    await waitFor(() =>
      expect(screen.getByTestId('relation-timeline')).toBeInTheDocument(),
    );

    const container = screen.getByTestId('relation-timeline');
    expect(container.querySelectorAll('a, button')).toHaveLength(0);
  });
});

describe('RelationTimeline — error', () => {
  it('fetch 실패 → role="alert" 표시', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network Error'));
    renderWithProviders(<RelationTimeline relationId={REL_ID} />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

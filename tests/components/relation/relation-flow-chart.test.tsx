// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RelationFlowChart } from '@/components/relation/relation-flow-chart';
import type { FlowPoint } from '@/types/relation';

describe('RelationFlowChart', () => {
  it('0점 → 빈 안내 메시지 표시, polyline 없음', () => {
    const { container, getByTestId } = render(<RelationFlowChart points={[]} />);
    expect(getByTestId('flow-chart-empty')).toBeInTheDocument();
    expect(container.querySelector('polyline')).toBeNull();
  });

  it('1점 → 단일 점 마커, polyline 없음', () => {
    const points: FlowPoint[] = [{ date: '2026-05-01', score: 50 }];
    const { container, queryByTestId } = render(<RelationFlowChart points={points} />);
    expect(queryByTestId('flow-chart-empty')).toBeNull();
    expect(container.querySelector('[data-testid="flow-point"]')).not.toBeNull();
    expect(container.querySelector('polyline')).toBeNull();
  });

  it('N점(N>=2) → polyline 1개 + N개 점 마커', () => {
    const points: FlowPoint[] = [
      { date: '2026-05-01', score: 40 },
      { date: '2026-05-02', score: 60 },
      { date: '2026-05-03', score: 80 },
    ];
    const { container } = render(<RelationFlowChart points={points} />);
    expect(container.querySelector('polyline')).not.toBeNull();
    expect(container.querySelectorAll('[data-testid="flow-point"]')).toHaveLength(3);
  });

  it('최신 온도·직전 대비·최근 기록을 함께 표시한다', () => {
    const points: FlowPoint[] = [
      { date: '2026-06-05', score: 78 },
      { date: '2026-06-06', score: 80 },
      { date: '2026-06-13', score: 86 },
    ];
    render(<RelationFlowChart points={points} />);

    expect(screen.getAllByText('38.80°C')).not.toHaveLength(0);
    expect(screen.getAllByText('+0.30°C')).not.toHaveLength(0);
    expect(screen.getByText(/2026\.06\.13 기준 38\.80°C/)).toBeInTheDocument();
    expect(screen.getByText('3회')).toBeInTheDocument();
    expect(screen.getByText('2026.06.06')).toBeInTheDocument();
  });

  it('근접 점수도 2자리 상세 온도로 구분해 날짜별 편차를 표시한다', () => {
    const points: FlowPoint[] = [
      { date: '2026-06-05', score: 85 },
      { date: '2026-06-13', score: 86 },
    ];
    const { container } = render(<RelationFlowChart points={points} />);

    expect(screen.getByText(/직전 기록보다 \+0\.05°C/)).toBeInTheDocument();
    expect(screen.getAllByText('38.75°C')).not.toHaveLength(0);
    expect(screen.getAllByText('38.80°C')).not.toHaveLength(0);
    expect(screen.getAllByText('+0.05°C')).not.toHaveLength(0);
    expect(screen.queryByText('+0.1°C')).toBeNull();

    const markers = container.querySelectorAll('[data-testid="flow-point"]');
    expect(markers[0].getAttribute('cy')).not.toBe(markers[1].getAttribute('cy'));
  });

  it('마지막 점 — data-today="true" 강조 마커', () => {
    const points: FlowPoint[] = [
      { date: '2026-05-01', score: 40 },
      { date: '2026-05-02', score: 70 },
    ];
    const { container } = render(<RelationFlowChart points={points} />);
    const markers = container.querySelectorAll('[data-testid="flow-point"]');
    expect(markers[markers.length - 1]).toHaveAttribute('data-today', 'true');
    expect(markers[0]).toHaveAttribute('data-today', 'false');
  });

  it('score=0 → y=SVG_H(하단), score=100 → y=0(상단) 스케일', () => {
    const points: FlowPoint[] = [
      { date: '2026-05-01', score: 0 },
      { date: '2026-05-02', score: 100 },
    ];
    const { container } = render(<RelationFlowChart points={points} />);
    const markers = container.querySelectorAll('[data-testid="flow-point"]');
    const cy0 = Number(markers[0].getAttribute('cy'));
    const cy100 = Number(markers[1].getAttribute('cy'));
    expect(cy0).toBeGreaterThan(cy100); // score 0 이 아래, 100 이 위
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { DailyTalismanRitual } from './daily-talisman-ritual';
import type { ChartCore } from '@/types/chart';

const trackTalismanEvent = vi.hoisted(() => vi.fn());
vi.mock('@/lib/analytics/ait-analytics', () => ({
  trackTalismanEvent,
}));

const CHART: ChartCore = {
  year_pillar: '甲子',
  month_pillar: '乙丑',
  day_pillar: '丙寅',
  hour_pillar: '丁卯',
  day_master_element: '화',
  five_elements_counts: { 목: 2, 화: 0, 토: 2, 금: 1, 수: 3 },
  gender_normalized: 'F',
  yunse: {
    daeun: { start_age: 8, list: [], current_index: 0 },
    seyun: { current_pillar: '丙午', current_year: 2026 },
    wolun: { current_pillar: '甲午', current_month: '2026-06' },
    iliun: { today_pillar: '병자', today_date: '2026-06-30' },
  },
};

const CANVAS_CONTEXT = {
  scale: vi.fn(),
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  lineCap: 'round',
  lineJoin: 'round',
  lineWidth: 8,
  strokeStyle: '',
};

describe('DailyTalismanRitual', () => {
  beforeEach(() => {
    localStorage.clear();
    trackTalismanEvent.mockClear();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(CANVAS_CONTEXT as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('CTA를 누른 뒤 한자 따라쓰기를 완료하면 오늘의 가드 상태로 바뀐다', () => {
    render(<DailyTalismanRitual chart={CHART} todayDate="2026-06-30" />);

    fireEvent.click(screen.getByRole('button', { name: '액땜 부적 받기' }));

    const sealButton = screen.getByRole('button', { name: '봉인하기' });
    expect(sealButton).toBeDisabled();

    const canvas = screen.getByRole('slider', { name: /따라쓰기 영역/ });
    fireEvent.pointerDown(canvas, { clientX: 16, clientY: 16 });
    for (let i = 0; i < 10; i += 1) {
      fireEvent.pointerMove(canvas, { clientX: 16 + i * 4, clientY: 20 + i * 3 });
    }
    fireEvent.pointerUp(canvas);

    expect(sealButton).not.toBeDisabled();
    fireEvent.click(sealButton);

    expect(screen.getByLabelText('오늘의 액땜 부적 완료')).toBeInTheDocument();
    expect(screen.getByText(/가드 ON/)).toBeInTheDocument();
  });

  it('키보드(Enter)만으로도 포인터 없이 부적을 완성할 수 있다', () => {
    render(<DailyTalismanRitual chart={CHART} todayDate="2026-06-30" />);

    fireEvent.click(screen.getByRole('button', { name: '액땜 부적 받기' }));
    const canvas = screen.getByRole('slider', { name: /따라쓰기 영역/ });
    const sealButton = screen.getByRole('button', { name: '봉인하기' });
    expect(sealButton).toBeDisabled();
    // a11y: 진행률을 슬라이더 값으로 노출해야 AT 사용자가 채움 정도를 알 수 있다.
    expect(canvas).toHaveAttribute('aria-valuemax', '100');
    expect(canvas).toHaveAttribute('aria-valuenow', '0');

    for (let i = 0; i < 5; i += 1) {
      fireEvent.keyDown(canvas, { key: 'Enter' });
    }

    expect(canvas).toHaveAttribute('aria-valuenow', '100');
    expect(sealButton).not.toBeDisabled();
    fireEvent.click(sealButton);
    expect(screen.getByLabelText('오늘의 액땜 부적 완료')).toBeInTheDocument();
  });

  it('오늘 이미 완료한 부적은 localStorage에서 복원한다', () => {
    const first = render(<DailyTalismanRitual chart={CHART} todayDate="2026-06-30" />);
    fireEvent.click(screen.getByRole('button', { name: '액땜 부적 받기' }));
    const canvas = screen.getByRole('slider', { name: /따라쓰기 영역/ });
    fireEvent.pointerDown(canvas, { clientX: 16, clientY: 16 });
    for (let i = 0; i < 10; i += 1) {
      fireEvent.pointerMove(canvas, { clientX: 16 + i * 4, clientY: 20 + i * 3 });
    }
    fireEvent.pointerUp(canvas);
    fireEvent.click(screen.getByRole('button', { name: '봉인하기' }));
    first.unmount();

    render(<DailyTalismanRitual chart={CHART} todayDate="2026-06-30" />);

    expect(screen.queryByRole('button', { name: '액땜 부적 받기' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('오늘의 액땜 부적 완료')).toBeInTheDocument();
  });

  it('차트에 오행 데이터가 없으면(크래시 가드) 아무것도 렌더하지 않는다', () => {
    const broken = { ...CHART, five_elements_counts: { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 } };
    const { container } = render(<DailyTalismanRitual chart={broken} todayDate="2026-06-30" />);

    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('button', { name: '액땜 부적 받기' })).not.toBeInTheDocument();
  });

  it('시작과 완료 시 리텐션 계측 이벤트를 보낸다', () => {
    render(<DailyTalismanRitual chart={CHART} todayDate="2026-06-30" />);

    expect(trackTalismanEvent).toHaveBeenCalledWith('talisman_view', expect.any(Object));

    fireEvent.click(screen.getByRole('button', { name: '액땜 부적 받기' }));
    expect(trackTalismanEvent).toHaveBeenCalledWith('talisman_start', expect.any(Object));

    const canvas = screen.getByRole('slider', { name: /따라쓰기 영역/ });
    for (let i = 0; i < 5; i += 1) {
      fireEvent.keyDown(canvas, { key: 'Enter' });
    }
    fireEvent.click(screen.getByRole('button', { name: '봉인하기' }));
    expect(trackTalismanEvent).toHaveBeenCalledWith('talisman_complete', expect.any(Object));
  });

  it('연속으로 봉인하면 N일 연속 배지를 보여준다(리텐션 streak)', () => {
    function completeOnce() {
      fireEvent.click(screen.getByRole('button', { name: '액땜 부적 받기' }));
      const canvas = screen.getByRole('slider', { name: /따라쓰기 영역/ });
      for (let i = 0; i < 5; i += 1) {
        fireEvent.keyDown(canvas, { key: 'Enter' });
      }
      fireEvent.click(screen.getByRole('button', { name: '봉인하기' }));
    }

    const day1 = render(<DailyTalismanRitual chart={CHART} todayDate="2026-06-30" />);
    completeOnce();
    // 첫날(count 1) → 연속 배지 없음
    expect(screen.queryByText(/연속/)).not.toBeInTheDocument();
    day1.unmount();

    // 다음날 연속 봉인 → 2일 연속 배지
    render(<DailyTalismanRitual chart={CHART} todayDate="2026-07-01" />);
    completeOnce();
    expect(screen.getByText(/2일 연속/)).toBeInTheDocument();
  });
});

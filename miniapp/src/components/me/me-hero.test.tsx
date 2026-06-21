import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';

import { renderWithProviders } from '@/test/render';
import { convertHanja } from '@/lib/glossary/post-process';
import type { ChartCore } from '@/types/chart';
import type { OhaengElement } from '@/lib/saju/elementLabel';
import { MeHero } from './me-hero';

// me-hero 는 chart.day_pillar + chart.day_master_element 만 읽는다 — 최소 픽스처.
function makeChart(overrides: Partial<ChartCore> = {}): ChartCore {
  return {
    day_pillar: '甲子',
    day_master_element: '목',
    ...overrides,
  } as unknown as ChartCore;
}

const READING = convertHanja('甲子'); // 한자 미노출(ADR-038) → 한글 독음

describe('MeHero (Dawn)', () => {
  it('me-hero 컨테이너와 Dawn 워터컬러 배경을 렌더한다', () => {
    renderWithProviders(<MeHero chart={makeChart()} onEdit={vi.fn()} />);
    const hero = screen.getByTestId('me-hero');
    expect(within(hero).getByTestId('dawn-hero-bg')).toBeInTheDocument();
  });

  it('일주를 한글 독음으로(타이틀·글리프 타일) 렌더한다', () => {
    renderWithProviders(<MeHero chart={makeChart()} onEdit={vi.fn()} />);
    expect(screen.getByTestId('me-hero-title')).toHaveTextContent(READING);
    expect(screen.getByTestId('me-hero-tile')).toHaveTextContent(READING);
  });

  it('닉네임 · 생일 서브타이틀을 렌더한다', () => {
    renderWithProviders(
      <MeHero chart={makeChart()} nickname="별명" birthDateLabel="1992.07.14 양력" onEdit={vi.fn()} />,
    );
    expect(screen.getByText('별명 · 1992.07.14 양력')).toBeInTheDocument();
  });

  it('편집 버튼 클릭 시 onEdit 를 호출한다', () => {
    const onEdit = vi.fn();
    renderWithProviders(<MeHero chart={makeChart()} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole('button', { name: '프로필 수정' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('글리프 타일에 원소 tone(soft 배경 + base 색)을 적용한다', () => {
    renderWithProviders(<MeHero chart={makeChart({ day_master_element: '목' })} onEdit={vi.fn()} />);
    const tile = screen.getByTestId('me-hero-tile');
    expect(tile.style.background).toContain('var(--accent-wood-soft)');
    expect(tile.style.color).toContain('var(--accent-wood)');
  });

  it('일간 성향 전체 문장을 렌더한다', () => {
    renderWithProviders(<MeHero chart={makeChart({ day_master_element: '수' })} onEdit={vi.fn()} />);
    expect(screen.getByText('물처럼 유연하고 지혜로운 기질을 지니고 있어요.')).toBeInTheDocument();
  });

  it('미지 원소면 wood tone 으로 폴백하고 throw 하지 않는다', () => {
    expect(() =>
      renderWithProviders(
        <MeHero chart={makeChart({ day_master_element: 'X' as OhaengElement })} onEdit={vi.fn()} />,
      ),
    ).not.toThrow();
    expect(screen.getByTestId('me-hero-tile').style.background).toContain('var(--accent-wood-soft)');
  });
});

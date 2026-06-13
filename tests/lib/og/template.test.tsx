// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { OgTemplate } from '@/lib/og/template';
import type { OgPayload } from '@/lib/og/render-payload';

function payload(overrides: Partial<OgPayload>): OgPayload {
  return {
    nickname: '봄달',
    score: 78,
    temperature_label: '38.4°C',
    mode: '친구 관계',
    layout: 'minimal',
    showGender: false,
    ...overrides,
  };
}

describe('OgTemplate — 공통 셸', () => {
  it('모든 레이아웃에 별명·모드·케미온도 노출', () => {
    const { getByText } = render(<OgTemplate payload={payload({ layout: 'minimal' })} />);
    expect(getByText(/봄달/)).toBeInTheDocument();
    expect(getByText(/친구 관계/)).toBeInTheDocument();
    expect(getByText(/38\.4°C/)).toBeInTheDocument();
  });
});

describe('OgTemplate — minimal', () => {
  it('온도만, 오행·레이더·코멘트·흐름 마커 없음', () => {
    const { container, queryByText } = render(
      <OgTemplate payload={payload({ layout: 'minimal' })} />,
    );
    expect(container.querySelector('svg')).toBeNull();
    expect(queryByText(/목/)).toBeNull();
  });
});

describe('OgTemplate — ohaeng', () => {
  it('오행 카운트(목/화/토/금/수) 노출', () => {
    const { getByText } = render(
      <OgTemplate
        payload={payload({ layout: 'ohaeng', ohaeng_counts: { 목: 3, 화: 1, 토: 2, 금: 1, 수: 1 } })}
      />,
    );
    expect(getByText(/목/)).toBeInTheDocument();
    expect(getByText(/수/)).toBeInTheDocument();
  });
});

describe('OgTemplate — radar', () => {
  it('영역 레이더 SVG(오각형) 노출', () => {
    const { container } = render(
      <OgTemplate
        payload={payload({
          layout: 'radar',
          area_scores: { talk: 80, attract: 60, speed: 50, money: 70, future: 65 },
        })}
      />,
    );
    const svg = container.querySelector('svg[data-testid="og-radar"]');
    expect(svg).not.toBeNull();
    // 오각형 polygon 존재
    expect(svg?.querySelector('polygon')).not.toBeNull();
  });
});

describe('OgTemplate — comment', () => {
  it('한 줄 코멘트(headline) 노출', () => {
    const { getByText } = render(
      <OgTemplate payload={payload({ layout: 'comment', headline: '동료감이 큰 사이예요' })} />,
    );
    expect(getByText(/동료감이 큰 사이예요/)).toBeInTheDocument();
  });
});

describe('OgTemplate — flow', () => {
  it('흐름 스파크라인 SVG 노출', () => {
    const { container } = render(
      <OgTemplate payload={payload({ layout: 'flow', flow_scores: [60, 65, 70, 78] })} />,
    );
    const svg = container.querySelector('svg[data-testid="og-flow"]');
    expect(svg).not.toBeNull();
    expect(svg?.querySelector('polyline')).not.toBeNull();
  });
});

describe('OgTemplate — 성별 토글 (ADR-024 옵트인)', () => {
  it('showGender=true → 성별 노출 (레이아웃과 직교)', () => {
    const { getByText } = render(
      <OgTemplate payload={payload({ layout: 'radar', showGender: true, gender_normalized: 'F', area_scores: { talk: 80, attract: 60, speed: 50, money: 70, future: 65 } })} />,
    );
    expect(getByText('여성')).toBeInTheDocument();
  });

  it('showGender=false → 성별 미노출', () => {
    const { queryByText } = render(
      <OgTemplate payload={payload({ layout: 'minimal', showGender: false, gender_normalized: 'F' })} />,
    );
    expect(queryByText('여성')).toBeNull();
  });
});

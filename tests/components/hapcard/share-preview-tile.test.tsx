// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { HapcardSharePreviewTile } from '@/components/hapcard/share-preview-tile';
import type { SharePayloadInput } from '@/lib/share/build-share-payload';

const MOCK: SharePayloadInput = {
  hapcard_id: 'hap-001',
  mode: '썸합',
  nickname: '봄달',
  score: 73,
  gender_normalized: 'F',
  ohaeng_counts: { 목: 3, 화: 1, 토: 2, 금: 1, 수: 1 },
  origin: 'https://hap.plae',
};

describe('HapcardSharePreviewTile', () => {
  it('1:1 aspect-ratio + aria-label "공유 미리보기" 렌더', () => {
    renderWithProviders(<HapcardSharePreviewTile hapcard={MOCK} range="nickname-only" />);
    const tile = screen.getByLabelText('공유 미리보기');
    expect(tile).toBeInTheDocument();
    expect(tile.className).toMatch(/aspect-square/);
  });

  it('닉네임 + 모드 + 오늘온도 노출', () => {
    renderWithProviders(<HapcardSharePreviewTile hapcard={MOCK} range="nickname-only" />);
    expect(screen.getByText(/봄달/)).toBeInTheDocument();
    expect(screen.getByText(/끌리는 사이/)).toBeInTheDocument();
    expect(screen.getByText('38.2')).toBeInTheDocument();
    expect(screen.getByText('°C')).toBeInTheDocument();
    expect(screen.queryByText('73')).toBeNull();
  });

  it('range=nickname-ohaeng → 오행 counts 보임', () => {
    renderWithProviders(<HapcardSharePreviewTile hapcard={MOCK} range="nickname-ohaeng" />);
    expect(screen.getByText(/목3/)).toBeInTheDocument();
  });

  it('range=nickname-gender → 성별 보임', () => {
    renderWithProviders(<HapcardSharePreviewTile hapcard={MOCK} range="nickname-gender" />);
    expect(screen.getByText('여성')).toBeInTheDocument();
  });

  it('range=nickname-only → 오행·성별 미노출', () => {
    renderWithProviders(<HapcardSharePreviewTile hapcard={MOCK} range="nickname-only" />);
    expect(screen.queryByText(/목3/)).toBeNull();
    expect(screen.queryByText('여성')).toBeNull();
  });

  it('PII 회귀: 생일·이메일·본명 형식 문자열은 어떤 range에서도 DOM 미노출', () => {
    const ranges = ['nickname-only', 'nickname-ohaeng', 'nickname-gender'] as const;
    for (const range of ranges) {
      const { container, unmount } = renderWithProviders(
        <HapcardSharePreviewTile hapcard={MOCK} range={range} />,
      );
      const text = container.textContent ?? '';
      expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/); // ISO 생일
      expect(text).not.toMatch(/@/); // 이메일
      expect(text).not.toMatch(/\d{4}년 \d{1,2}월 \d{1,2}일/); // 한국어 생일
      unmount();
    }
  });
});

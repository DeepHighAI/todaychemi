// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { ShareSheet } from '@/components/hapcard/share-sheet';
import type { SharePayloadInput } from '@/lib/share/build-share-payload';

const MOCK_HAPCARD: SharePayloadInput = {
  hapcard_id: 'hap-uuid-001',
  mode: '친구합',
  nickname: '봄달',
  score: 78,
  gender_normalized: 'F',
  ohaeng_counts: { 목: 3, 화: 1, 토: 2, 금: 1, 수: 1 },
  origin: 'https://hap.plae',
};

function renderSheet(onShare = vi.fn(), onOpenChange = vi.fn(), open = true) {
  renderWithProviders(
    <ShareSheet open={open} onOpenChange={onOpenChange} hapcard={MOCK_HAPCARD} onShare={onShare} />,
  );
  return { onShare, onOpenChange };
}

describe('ShareSheet — 레이아웃 5종 탭', () => {
  it('open=true 시 5개 레이아웃 탭 표시', () => {
    renderSheet();
    expect(screen.getByRole('button', { name: '온도만' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '오행' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '영역' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '한 줄' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '흐름' })).toBeInTheDocument();
  });

  it('기본 선택 = minimal (온도만 탭 aria-pressed=true)', () => {
    renderSheet();
    expect(screen.getByRole('button', { name: '온도만' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('카카오톡 → onShare(minimal, false, kakao)', () => {
    const { onShare } = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: '카카오톡' }));
    expect(onShare).toHaveBeenCalledWith('minimal', false, 'kakao');
  });

  it('레이아웃 탭 변경 후 인스타그램 → 변경된 layout 으로 onShare', () => {
    const { onShare } = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: '영역' }));
    fireEvent.click(screen.getByRole('button', { name: '인스타그램/카드' }));
    expect(onShare).toHaveBeenCalledWith('radar', false, 'instagram');
  });

  it('성별 토글 ON 후 링크 복사 → showGender=true 로 onShare', () => {
    const { onShare } = renderSheet();
    fireEvent.click(screen.getByLabelText('성별 표시'));
    fireEvent.click(screen.getByRole('button', { name: '링크 복사' }));
    expect(onShare).toHaveBeenCalledWith('minimal', true, 'copy_link');
  });
});

describe('ShareSheet — 프리뷰 = 실제 OG 이미지', () => {
  it('프리뷰 img src 가 선택 레이아웃의 authed OG 라우트를 가리킨다', () => {
    renderSheet();
    const img = screen.getByLabelText('공유 미리보기') as HTMLImageElement;
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('src')).toContain('/api/og/hapcard/hap-uuid-001');
    expect(img.getAttribute('src')).toContain('layout=minimal');
    expect(img.getAttribute('src')).toContain('gender=0');
  });

  it('레이아웃·성별 변경 시 프리뷰 src 갱신', () => {
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: '흐름' }));
    fireEvent.click(screen.getByLabelText('성별 표시'));
    const img = screen.getByLabelText('공유 미리보기') as HTMLImageElement;
    expect(img.getAttribute('src')).toContain('layout=flow');
    expect(img.getAttribute('src')).toContain('gender=1');
  });
});

describe('ShareSheet — 기타', () => {
  it('취소 → onOpenChange(false)', () => {
    const { onOpenChange } = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('open=false 시 탭 미노출', () => {
    renderSheet(vi.fn(), vi.fn(), false);
    expect(screen.queryByRole('button', { name: '온도만' })).toBeNull();
  });
});

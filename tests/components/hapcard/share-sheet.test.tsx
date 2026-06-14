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

describe('ShareSheet — 통합 공유 카드', () => {
  it('open=true 시 공유 미리보기와 액션만 표시하고 레이아웃 탭은 숨긴다', () => {
    renderSheet();
    expect(screen.getByLabelText('공유 미리보기')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '온도만' })).toBeNull();
    expect(screen.queryByRole('button', { name: '오행' })).toBeNull();
    expect(screen.queryByRole('button', { name: '영역' })).toBeNull();
    expect(screen.queryByRole('button', { name: '한 줄' })).toBeNull();
    expect(screen.queryByRole('button', { name: '흐름' })).toBeNull();
  });

  it('카카오톡 → onShare(combined, false, kakao)', () => {
    const { onShare } = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: '카카오톡' }));
    expect(onShare).toHaveBeenCalledWith('combined', false, 'kakao');
  });

  it('인스타그램 → 통합 카드 layout 으로 onShare', () => {
    const { onShare } = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: '인스타그램/카드' }));
    expect(onShare).toHaveBeenCalledWith('combined', false, 'instagram');
  });

  it('성별 토글 ON 후 링크 복사 → showGender=true 로 onShare', () => {
    const { onShare } = renderSheet();
    fireEvent.click(screen.getByLabelText('성별 표시'));
    fireEvent.click(screen.getByRole('button', { name: '링크 복사' }));
    expect(onShare).toHaveBeenCalledWith('combined', true, 'copy_link');
  });
});

describe('ShareSheet — 프리뷰 = 실제 OG 이미지', () => {
  it('프리뷰 img src 가 선택 레이아웃의 authed OG 라우트를 가리킨다', () => {
    renderSheet();
    const img = screen.getByLabelText('공유 미리보기') as HTMLImageElement;
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('src')).toContain('/api/og/hapcard/hap-uuid-001');
    expect(img.getAttribute('src')).toContain('layout=combined');
    expect(img.getAttribute('src')).toContain('gender=0');
    expect(img.getAttribute('src')).toContain('v=5');
    expect(img.getAttribute('width')).toBe('1080');
    expect(img.getAttribute('height')).toBe('1350');
    expect(img.getAttribute('src')).toContain('ohaeng=3%2C1%2C2%2C1%2C1');
  });

  it('성별 변경 시 프리뷰 src 갱신', () => {
    renderSheet();
    fireEvent.click(screen.getByLabelText('성별 표시'));
    const img = screen.getByLabelText('공유 미리보기') as HTMLImageElement;
    expect(img.getAttribute('src')).toContain('layout=combined');
    expect(img.getAttribute('src')).toContain('gender=1');
    expect(img.getAttribute('src')).toContain('v=5');
    expect(img.getAttribute('src')).toContain('ohaeng=3%2C1%2C2%2C1%2C1');
  });
});

describe('ShareSheet — 기타', () => {
  it('취소 → onOpenChange(false)', () => {
    const { onOpenChange } = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('open=false 시 미리보기 미노출', () => {
    renderSheet(vi.fn(), vi.fn(), false);
    expect(screen.queryByLabelText('공유 미리보기')).toBeNull();
  });
});

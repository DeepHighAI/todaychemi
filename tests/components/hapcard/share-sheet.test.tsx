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

describe('ShareSheet', () => {
  it('open=true 시 3개 범위 라디오 옵션 표시', () => {
    renderWithProviders(
      <ShareSheet open={true} onOpenChange={vi.fn()} hapcard={MOCK_HAPCARD} onShare={vi.fn()} />,
    );
    expect(screen.getByLabelText('별명만')).toBeInTheDocument();
    expect(screen.getByLabelText('별명 + 오행')).toBeInTheDocument();
    expect(screen.getByLabelText('별명 + 성별')).toBeInTheDocument();
  });

  it('기본 선택 = nickname-only (별명만 라디오 checked)', () => {
    renderWithProviders(
      <ShareSheet open={true} onOpenChange={vi.fn()} hapcard={MOCK_HAPCARD} onShare={vi.fn()} />,
    );
    const radio = screen.getByLabelText('별명만') as HTMLInputElement;
    expect(radio.checked).toBe(true);
  });

  it('"공유하기" 버튼 클릭 → onShare(range) 호출', () => {
    const onShare = vi.fn();
    renderWithProviders(
      <ShareSheet open={true} onOpenChange={vi.fn()} hapcard={MOCK_HAPCARD} onShare={onShare} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '공유하기' }));
    expect(onShare).toHaveBeenCalledWith('nickname-only');
  });

  it('라디오 변경 후 "공유하기" → 변경된 range로 onShare 호출', () => {
    const onShare = vi.fn();
    renderWithProviders(
      <ShareSheet open={true} onOpenChange={vi.fn()} hapcard={MOCK_HAPCARD} onShare={onShare} />,
    );
    fireEvent.click(screen.getByLabelText('별명 + 오행'));
    fireEvent.click(screen.getByRole('button', { name: '공유하기' }));
    expect(onShare).toHaveBeenCalledWith('nickname-ohaeng');
  });

  it('"취소" 버튼 클릭 → onOpenChange(false) 호출', () => {
    const onOpenChange = vi.fn();
    renderWithProviders(
      <ShareSheet open={true} onOpenChange={onOpenChange} hapcard={MOCK_HAPCARD} onShare={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('open=false 시 라디오 옵션 미노출', () => {
    renderWithProviders(
      <ShareSheet open={false} onOpenChange={vi.fn()} hapcard={MOCK_HAPCARD} onShare={vi.fn()} />,
    );
    expect(screen.queryByLabelText('별명만')).toBeNull();
  });

  it('open=true 시 미리보기 타일이 마운트됨 (aria-label "공유 미리보기")', () => {
    renderWithProviders(
      <ShareSheet open={true} onOpenChange={vi.fn()} hapcard={MOCK_HAPCARD} onShare={vi.fn()} />,
    );
    expect(screen.getByLabelText('공유 미리보기')).toBeInTheDocument();
  });
});

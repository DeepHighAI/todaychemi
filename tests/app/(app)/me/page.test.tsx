// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../utils/render-with-providers';

async function renderMePage() {
  const { default: MePage } = await import('@/app/(app)/me/page');
  return renderWithProviders(<MePage />);
}

describe('MePage (placeholder)', () => {
  it('placeholder 텍스트("내사주 준비 중")를 렌더한다', async () => {
    await renderMePage();
    expect(screen.getByText('내사주 준비 중')).toBeInTheDocument();
  });

  it('h1 헤딩으로 placeholder 노출 (랜드마크)', async () => {
    await renderMePage();
    expect(screen.getByRole('heading', { level: 1, name: '내사주 준비 중' })).toBeInTheDocument();
  });
});

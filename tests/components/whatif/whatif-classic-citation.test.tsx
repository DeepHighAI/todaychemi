// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { WhatifClassicCitation } from '@/components/whatif/whatif-classic-citation';
import { MOCK_CITATION } from '../../fixtures/whatif';
import type { ClassicCitation } from '@/types/diagnostic';

const MOCK_CITATION_2: ClassicCitation = {
  asset_id: 'asset-2',
  source_title: '명리정종',
  source_chapter: '제3장',
  original_text: '두 번째 원문',
  modern_translation: '두 번째 번역',
};

describe('WhatifClassicCitation', () => {
  it('citations={undefined} → 렌더 안 함', () => {
    renderWithProviders(<WhatifClassicCitation />);
    expect(document.querySelector('[data-testid="whatif-classic-citation"]')).toBeNull();
  });

  it('citations={[]} → 렌더 안 함', () => {
    renderWithProviders(<WhatifClassicCitation citations={[]} />);
    expect(document.querySelector('[data-testid="whatif-classic-citation"]')).toBeNull();
  });

  it('1건 → 헤더 "고전 인용" + 4개 필드 모두 노출', () => {
    renderWithProviders(<WhatifClassicCitation citations={[MOCK_CITATION]} />);
    expect(document.querySelector('[data-testid="whatif-classic-citation"]')).not.toBeNull();
    expect(screen.getByText('고전 인용')).toBeInTheDocument();
    expect(screen.getByText(MOCK_CITATION.source_title)).toBeInTheDocument();
    expect(screen.getByText(MOCK_CITATION.source_chapter)).toBeInTheDocument();
    expect(screen.getByText(MOCK_CITATION.original_text)).toBeInTheDocument();
    expect(screen.getByText(MOCK_CITATION.modern_translation)).toBeInTheDocument();
  });

  it('2건 → li 2개 렌더', () => {
    renderWithProviders(
      <WhatifClassicCitation citations={[MOCK_CITATION, MOCK_CITATION_2]} />,
    );
    expect(screen.getByText(MOCK_CITATION.source_title)).toBeInTheDocument();
    expect(screen.getByText(MOCK_CITATION_2.source_title)).toBeInTheDocument();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '@/test/render';

// vaul Drawer 는 jsdom 측정/포털 의존 → 패스스루 mock 으로 LegalDocSheet 자체 배선만 검증.
vi.mock('@/components/ui/drawer', () => ({
  Drawer: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="drawer">{children}</div> : null,
  DrawerContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DrawerTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DrawerDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DrawerClose: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
}));

import { LegalDocSheet } from './legal-doc-sheet';

const TERMS_DOC = {
  slug: 'terms',
  title: '이용약관',
  version: '2026-06-15',
  markdown: '# 이용약관\n\n약관 본문 단락입니다.',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('LegalDocSheet', () => {
  it('open=true 면 제목과 fetch 한 문서 본문을 렌더한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => TERMS_DOC }),
    );

    renderWithProviders(<LegalDocSheet slug="terms" open onOpenChange={vi.fn()} />);

    // 시트 제목(i18n 라벨)
    expect(screen.getByRole('heading', { name: '이용약관' })).toBeInTheDocument();
    // fetch 한 마크다운 본문
    expect(await screen.findByText('약관 본문 단락입니다.')).toBeInTheDocument();
  });

  it('open=false 면 아무것도 렌더하지 않는다', () => {
    vi.stubGlobal('fetch', vi.fn());
    renderWithProviders(<LegalDocSheet slug="terms" open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByTestId('drawer')).not.toBeInTheDocument();
  });
});

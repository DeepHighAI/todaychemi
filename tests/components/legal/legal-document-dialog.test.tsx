// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithIntl } from '../../utils/render-with-intl';
import { LegalDocumentDialog } from '@/components/legal/legal-document-dialog';

function jsonResponse(body: unknown, ok = true) {
  return new Response(JSON.stringify(body), {
    status: ok ? 200 : 500,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LegalDocumentDialog', () => {
  it('open + slug면 문서를 fetch 해 제목·시행일·본문을 렌더한다', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse({ title: '개인정보 처리방침(테스트)', version: '2026.06.01', markdown: '# 제1조\n\n수집 항목 본문' }),
    );

    renderWithIntl(<LegalDocumentDialog slug="privacy" open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('개인정보 처리방침(테스트)')).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/legal/documents/privacy', expect.any(Object));
    expect(screen.getByText('시행일 2026.06.01')).toBeInTheDocument();
    expect(screen.getByText('수집 항목 본문')).toBeInTheDocument();
  });

  it('fetch 실패 시 에러 안내 문구를 보여준다', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({}, false));

    renderWithIntl(<LegalDocumentDialog slug="privacy" open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('문서를 불러오지 못했어요. 잠시 후 다시 시도해주세요.')).toBeInTheDocument();
    });
  });

  it('로딩 중에는 폴백 제목과 불러오는 중 문구를 보여준다', () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));

    renderWithIntl(<LegalDocumentDialog slug="privacy" open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText('개인정보처리방침')).toBeInTheDocument();
    expect(screen.getByText('불러오는 중...')).toBeInTheDocument();
  });

  it('open=false면 문서를 fetch 하지 않고 다이얼로그를 렌더하지 않는다', () => {
    global.fetch = vi.fn();

    renderWithIntl(<LegalDocumentDialog slug="privacy" open={false} onOpenChange={vi.fn()} />);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

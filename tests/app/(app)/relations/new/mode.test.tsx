// @vitest-environment jsdom
// Tests for Step 3: mode/page.tsx (6모드 카드 + 동의 + 제출)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// mode 페이지는 ['feed'] 캐시로 사전 가격 고지를 판단 — QueryClientProvider 필요
import { renderWithProviders } from '../../../../utils/render-with-providers';
import messages from '../../../../../messages/ko.json';

vi.mock('zustand/middleware', () => ({
  persist: (fn: (set: unknown, get: unknown, api: unknown) => unknown) => fn,
}));

vi.mock('next/navigation', () => ({ useRouter: vi.fn(), usePathname: vi.fn() }));

// G-8: GA 배선 검증용 — trackEvent 만 mock (env 부재 시 no-op 이므로 호출 인자 검증엔 mock 필요)
vi.mock('@/lib/analytics/ga', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/analytics/ga')>();
  return { ...mod, trackEvent: vi.fn() };
});

// FeaturePaySheet 는 Toss SDK·vaul 의존 — 시트 자체 테스트가 커버. 여기선 prop 전달만 검증.
vi.mock('@/components/payments/feature-pay-sheet', () => ({
  FeaturePaySheet: ({
    feature,
    featureRef,
    next,
    open,
    onOpenChange,
  }: {
    feature: string;
    featureRef: string;
    next: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div
      data-testid="pay-sheet"
      data-feature={feature}
      data-ref={featureRef}
      data-next={next}
      data-open={String(open)}
    >
      <button type="button" onClick={() => onOpenChange(false)}>
        mock-close
      </button>
    </div>
  ),
}));

import { useRouter } from 'next/navigation';

const mockPush = vi.fn();
const mockFetch = vi.fn();

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(useRouter).mockReturnValue({ push: mockPush, back: vi.fn() } as never);
  vi.stubGlobal('fetch', mockFetch);
  const { useRelationDraft } = await import('@/lib/relations/draft-store');
  const s = useRelationDraft.getState();
  s.reset();
  s.setNickname('하늘');
  s.setGender('F');
  s.setBirthDate('1995-11-05');
  s.setKnowledge('exact');
  s.setBirthTime('14:20');
  s.setCalendar('solar');
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('RelationsModePage (Step 3)', () => {
  it('renders 6 mode cards', async () => {
    const { default: Page } = await import('@/app/(app)/relations/new/mode/page');
    renderWithProviders(<Page />);
    expect(screen.getByText('썸 관계')).toBeTruthy();
    expect(screen.getByText('오래된 관계')).toBeTruthy();
    expect(screen.getByText('일 관계')).toBeTruthy();
    expect(screen.getByText('친구 관계')).toBeTruthy();
    expect(screen.getByText('돈 관계')).toBeTruthy();
    expect(screen.getByText('첫 만남')).toBeTruthy();
  });

  it('등록하기 is disabled until mode and consent are set', async () => {
    const { default: Page } = await import('@/app/(app)/relations/new/mode/page');
    renderWithProviders(<Page />);
    const submit = screen.getByRole('button', { name: '등록하기' });
    expect(submit).toBeDisabled();
    const user = userEvent.setup();
    await user.click(screen.getByText('썸 관계'));
    expect(submit).toBeDisabled(); // consent 미체크
    await user.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(submit).toBeEnabled());
  });

  it('submits with correct body and redirects to /feed?focus=', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ relation_id: 'r-77' }),
    });
    const { default: Page } = await import('@/app/(app)/relations/new/mode/page');
    renderWithProviders(<Page />);
    const user = userEvent.setup();
    await user.click(screen.getByText('썸 관계'));
    await user.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(screen.getByRole('button', { name: '등록하기' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: '등록하기' }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/feed?focus=r-77'));
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.nickname).toBe('하늘');
    expect(body.gender).toBe('F');
    expect(body.mode).toBe('썸합');
    expect(body.birth_date).toBe('1995-11-05');
    expect(body.consent_confirmed).toBe(true);
  });

  it('등록 성공 시 GA relation_create 이벤트 발화 (G-8)', async () => {
    const { trackEvent } = await import('@/lib/analytics/ga');
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ relation_id: 'r-77' }),
    });
    const { default: Page } = await import('@/app/(app)/relations/new/mode/page');
    renderWithProviders(<Page />);
    const user = userEvent.setup();
    await user.click(screen.getByText('썸 관계'));
    await user.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(screen.getByRole('button', { name: '등록하기' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: '등록하기' }));
    await waitFor(() =>
      expect(trackEvent).toHaveBeenCalledWith({ name: 'relation_create', params: { mode: '썸합' } }),
    );
  });

  it('shows generic error on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    const { default: Page } = await import('@/app/(app)/relations/new/mode/page');
    renderWithProviders(<Page />);
    const user = userEvent.setup();
    await user.click(screen.getByText('썸 관계'));
    await user.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(screen.getByRole('button', { name: '등록하기' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: '등록하기' }));
    await waitFor(() => expect(screen.getByText(/저장에 실패/)).toBeTruthy());
  });
});

describe('RelationsModePage — 유료 슬롯 402 (ADR-039 Amended)', () => {
  function mock402() {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({
        error: { code: 'PAYMENT_REQUIRED', message: 'payment required' },
        feature: 'relation_slot',
        ref: 'relation_slot:pend-uuid-1',
        amount_krw: 1000,
      }),
    });
  }

  async function submitOnce() {
    const { default: Page } = await import('@/app/(app)/relations/new/mode/page');
    renderWithProviders(<Page />);
    const user = userEvent.setup();
    await user.click(screen.getByText('썸 관계'));
    await user.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(screen.getByRole('button', { name: '등록하기' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: '등록하기' }));
    return user;
  }

  it('402 PAYMENT_REQUIRED → FeaturePaySheet(relation_slot, ref, next=/feed) 오픈 + draft 보존', async () => {
    mock402();
    await submitOnce();

    const sheet = await screen.findByTestId('pay-sheet');
    expect(sheet.getAttribute('data-feature')).toBe('relation_slot');
    expect(sheet.getAttribute('data-ref')).toBe('relation_slot:pend-uuid-1');
    expect(sheet.getAttribute('data-next')).toBe('/feed');
    expect(sheet.getAttribute('data-open')).toBe('true');

    // draft.reset() 보류 — 결제 취소 시 3-step 입력이 살아 있어야 한다
    const { useRelationDraft } = await import('@/lib/relations/draft-store');
    expect(useRelationDraft.getState().nickname).toBe('하늘');
    expect(mockPush).not.toHaveBeenCalled();
    // submitting 해제 — 시트 닫은 뒤 재제출 가능
    expect(screen.getByRole('button', { name: '등록하기' })).toBeEnabled();
  });

  it('시트 닫기 → 시트 제거 + 결제 필요 안내 노출, 페이지 유지', async () => {
    mock402();
    const user = await submitOnce();

    await screen.findByTestId('pay-sheet');
    await user.click(screen.getByRole('button', { name: 'mock-close' }));

    await waitFor(() => expect(screen.queryByTestId('pay-sheet')).toBeNull());
    expect(screen.getByText(/등록하려면 결제가 필요/)).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('402 이지만 PAYMENT_REQUIRED 코드가 아니면 generic 에러로 처리', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({ error: { code: 'SOMETHING_ELSE' } }),
    });
    await submitOnce();

    await waitFor(() => expect(screen.getByText(/저장에 실패/)).toBeTruthy());
    expect(screen.queryByTestId('pay-sheet')).toBeNull();
  });
});

describe('RelationsModePage — 사전 가격 고지 (UX 보조, 권위는 서버 402)', () => {
  function feedItem(i: number) {
    return {
      relation_id: `r${i}`,
      nickname: `인연${i}`,
      mode: '친구합',
      compat_score: null,
      change_score: 0,
      has_significant_change: false,
      created_at: '2026-06-01T00:00:00Z',
    };
  }

  async function renderWithFeedCache(itemCount: number | null) {
    const { default: Page } = await import('@/app/(app)/relations/new/mode/page');
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    if (itemCount !== null) {
      qc.setQueryData(
        ['feed', ''],
        Array.from({ length: itemCount }, (_, i) => feedItem(i)),
      );
    }
    render(
      <NextIntlClientProvider locale="ko" messages={messages}>
        <QueryClientProvider client={qc}>
          <Page />
        </QueryClientProvider>
      </NextIntlClientProvider>,
    );
  }

  it('보유 인연 2건(캐시) → 세 번째부터 결제 고지 노출', async () => {
    await renderWithFeedCache(2);
    expect(screen.getByText(/세 번째 인연부터/)).toBeTruthy();
    expect(screen.getByText(/1,000원/)).toBeTruthy();
  });

  it('보유 인연 1건 → 고지 숨김', async () => {
    await renderWithFeedCache(1);
    expect(screen.queryByText(/세 번째 인연부터/)).toBeNull();
  });

  it('feed 캐시 없음 → 고지 숨김 (서버 402 가 권위 게이트)', async () => {
    await renderWithFeedCache(null);
    expect(screen.queryByText(/세 번째 인연부터/)).toBeNull();
  });
});

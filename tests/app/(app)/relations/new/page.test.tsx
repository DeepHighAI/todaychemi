// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '../../../../utils/render-with-intl';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

import { useRouter } from 'next/navigation';

const mockPush = vi.fn();
const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useRouter).mockReturnValue({ push: mockPush } as never);
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderRelationsNewPage() {
  const { default: RelationsNewPage } = await import('@/app/(app)/relations/new/page');
  return renderWithIntl(<RelationsNewPage />);
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText('인연을 부를 별명'), '봄달');
  // mode 선택
  await user.click(screen.getByRole('radio', { name: '친구' }));
  // gender
  await user.click(screen.getByRole('radio', { name: '여' }));
  // birth_date
  const dobInput = screen.getByLabelText('생년월일');
  await user.type(dobInput, '1995-07-20');
  // 시간 정확도 기본값 '정확해요' — birth_time 필드 나타남
  const timeInput = screen.getByLabelText('시간 입력');
  await user.type(timeInput, '09:00');
  // consent 동의
  await user.click(screen.getByRole('checkbox'));
}

describe('RelationsNewPage', () => {
  it('renders three section headings', async () => {
    await renderRelationsNewPage();
    expect(screen.getByRole('heading', { name: '인연 정보' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '생년월일' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '출생 시간' })).toBeInTheDocument();
  });

  it('renders nickname input with placeholder', async () => {
    await renderRelationsNewPage();
    expect(screen.getByPlaceholderText('인연을 부를 별명')).toBeInTheDocument();
  });

  it('renders all 6 mode radios', async () => {
    await renderRelationsNewPage();
    expect(screen.getByRole('radio', { name: '일 동료' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '친구' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '돈 거래' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '첫만남' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '썸' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '오래된 사이' })).toBeInTheDocument();
  });

  it('renders time accuracy toggle with 3 options', async () => {
    await renderRelationsNewPage();
    expect(screen.getByRole('radio', { name: '정확해요' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '대략 알아요' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '몰라요' })).toBeInTheDocument();
  });

  it('hides birth_time input when unknown selected, shows hint text', async () => {
    const user = userEvent.setup();
    await renderRelationsNewPage();
    await user.click(screen.getByRole('radio', { name: '몰라요' }));
    expect(screen.queryByLabelText('시간 입력')).not.toBeInTheDocument();
    expect(screen.getByText('정오 12:00로 가정해 추정해요')).toBeInTheDocument();
  });

  it('shows birth_time input when exact is selected (default)', async () => {
    await renderRelationsNewPage();
    expect(screen.getByLabelText('시간 입력')).toBeInTheDocument();
  });

  it('submit button is disabled when consent unchecked', async () => {
    await renderRelationsNewPage();
    const submit = screen.getByRole('button', { name: '등록하기' });
    expect(submit).toBeDisabled();
  });

  it('submit button becomes enabled after consent checked', async () => {
    const user = userEvent.setup();
    await renderRelationsNewPage();
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: '등록하기' })).not.toBeDisabled();
  });

  it('shows nicknameRequired error when submitting with empty nickname', async () => {
    const user = userEvent.setup();
    await renderRelationsNewPage();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: '등록하기' }));
    expect(await screen.findByText('별명을 입력해주세요.')).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('shows modeRequired error when no mode selected', async () => {
    const user = userEvent.setup();
    await renderRelationsNewPage();
    await user.type(screen.getByPlaceholderText('인연을 부를 별명'), '봄달');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: '등록하기' }));
    expect(await screen.findByText('관계 유형을 선택해주세요.')).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('calls POST /api/relations and redirects to /feed on success', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    const user = userEvent.setup();
    await renderRelationsNewPage();
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: '등록하기' }));
    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/relations',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/feed'));
  });

  it('shows generic error when POST returns non-ok', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ code: 'INTERNAL_ERROR' }) });
    const user = userEvent.setup();
    await renderRelationsNewPage();
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: '등록하기' }));
    await screen.findByText('저장에 실패했어요. 잠시 후 다시 시도해주세요.');
    expect(mockPush).not.toHaveBeenCalled();
  });
});

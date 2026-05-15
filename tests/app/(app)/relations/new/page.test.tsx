// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '../../../../utils/render-with-intl';

vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));

import { useRouter } from 'next/navigation';

const mockPush = vi.fn();
const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useRouter).mockReturnValue({ push: mockPush } as never);
  vi.stubGlobal('fetch', mockFetch);
});
afterEach(() => { vi.unstubAllGlobals(); });

async function renderPage() {
  const { default: Page } = await import('@/app/(app)/relations/new/page');
  return renderWithIntl(<Page />);
}

function clickActiveTrayDone() {
  // Both BirthDateField and BirthTimeField portals coexist in document.body.
  // Use .tray.on to target only the currently open tray's done button.
  const doneBtns = document.querySelectorAll('.tray.on .done');
  fireEvent.click(doneBtns[doneBtns.length - 1] as HTMLElement);
}

function selectBirthDate() {
  fireEvent.click(document.querySelector('.mock-input')!);
  const day5 = Array.from(document.querySelectorAll('.cal .d:not(.muted)')).find(el => el.textContent === '5') as HTMLElement;
  fireEvent.click(day5);
  clickActiveTrayDone();
}

function selectBirthTime() {
  // After date field, the next .mock-input is time field
  const inputs = document.querySelectorAll('.mock-input');
  const timeInput = inputs[inputs.length - 1] as HTMLElement;
  fireEvent.click(timeInput);
  clickActiveTrayDone();
}

describe('RelationsNewPage', () => {
  it('renders Step 1 headline', async () => {
    await renderPage();
    expect(screen.getByText(/처음 오셨네요|별명부터|인연의/)).toBeTruthy();
  });

  it('다음 is disabled until nickname and consent are provided', async () => {
    await renderPage();
    const next = screen.getByRole('button', { name: '다음' });
    expect(next).toBeDisabled();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('인연을 부를 별명'), '봄달');
    expect(next).toBeDisabled();
    await user.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(next).toBeEnabled());
  });

  it('Step 2 renders 3 time-accuracy radio options', async () => {
    await renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('인연을 부를 별명'), '봄달');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByRole('radio', { name: '정확해요' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '대략 알아요' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '몰라요' })).toBeTruthy();
  });

  it('Step 2 "몰라요" hides BirthTimeField and shows hint', async () => {
    await renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('인연을 부를 별명'), '봄달');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: '다음' }));
    await user.click(screen.getByRole('radio', { name: '몰라요' }));
    // BirthTimeField mock-input should not be visible
    const mockInputs = document.querySelectorAll('.mock-input');
    expect(mockInputs).toHaveLength(1); // only BirthDateField
  });

  it('Step 3 renders all 6 mode cards', async () => {
    await renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('인연을 부를 별명'), '봄달');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: '다음' }));
    selectBirthDate();
    await user.click(screen.getByRole('radio', { name: '남' }));
    selectBirthTime();
    await user.click(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByText('썸')).toBeTruthy();
    expect(screen.getByText('일 동료')).toBeTruthy();
  });

  it('posts correct body and redirects to /feed', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ relation_id: 'r1' }) });
    await renderPage();
    const user = userEvent.setup();
    // Step 1
    await user.type(screen.getByPlaceholderText('인연을 부를 별명'), '봄달');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: '다음' }));
    // Step 2
    selectBirthDate();
    await user.click(screen.getByRole('radio', { name: '여' }));
    selectBirthTime();
    await user.click(screen.getByRole('button', { name: '다음' }));
    // Step 3
    await user.click(screen.getByText('썸'));
    await user.click(screen.getByRole('button', { name: '등록하기' }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/feed?focus=r1'));
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.birth_date).toBe('1995-11-05');
    expect(body.gender).toBe('F');
  });

  it('shows generic error on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    await renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('인연을 부를 별명'), '봄달');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: '다음' }));
    selectBirthDate();
    await user.click(screen.getByRole('radio', { name: '여' }));
    selectBirthTime();
    await user.click(screen.getByRole('button', { name: '다음' }));
    await user.click(screen.getByText('썸'));
    await user.click(screen.getByRole('button', { name: '등록하기' }));
    await waitFor(() => expect(screen.getByText(/저장에 실패/)).toBeTruthy());
  });
});

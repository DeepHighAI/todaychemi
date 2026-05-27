// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LegalConsentBlock } from '@/components/legal/legal-consent-block';

const onChange = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          title: '이용약관',
          version: '2026-06-01',
          markdown: '# 오늘사이 서비스 이용약관\n\n본문입니다.',
        }),
        { status: 200 },
      ),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LegalConsentBlock', () => {
  it('opens legal documents in a layer popup with a visible close button', async () => {
    const user = userEvent.setup();
    render(
      <LegalConsentBlock
        value={{ terms: false, privacy: false, age: false }}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: '이용약관' }));

    await screen.findByRole('dialog');
    expect(await screen.findByRole('heading', { name: '오늘사이 서비스 이용약관' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '닫기' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '닫기' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

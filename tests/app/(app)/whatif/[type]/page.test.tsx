// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../../utils/render-with-providers';

const mockFetch = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ type: 'work' }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderPage() {
  const { default: Page } = await import('@/app/(app)/whatif/[type]/page');
  return renderWithProviders(<Page />);
}

describe('WhatifPage', () => {
  it('WhatifView 마운트 → loading-state 렌더', async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    await renderPage();
    expect(await screen.findByTestId('loading-state')).toBeInTheDocument();
  });
});

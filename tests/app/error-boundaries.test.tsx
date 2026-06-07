// @vitest-environment jsdom

import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const sentryMocks = vi.hoisted(() => ({
  captureException: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => sentryMocks);

import AppError from '@/app/error';
import GlobalError from '@/app/global-error';

describe('app error boundaries', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    sentryMocks.captureException.mockClear();
    consoleError.mockClear();
  });

  afterEach(() => {
    consoleError.mockClear();
  });

  it('app/error reports sanitized errors to console and Sentry', async () => {
    const error = new Error('render failed birth_date=1995-06-15 user_email=minji@example.com');

    render(<AppError error={error} reset={vi.fn()} />);

    await waitFor(() => expect(sentryMocks.captureException).toHaveBeenCalled());
    const sentryError = sentryMocks.captureException.mock.calls[0]?.[0] as Error;
    const consoleErrorArg = consoleError.mock.calls.find((call) => call[0] instanceof Error)?.[0] as
      | Error
      | undefined;

    expect(sentryError.message).not.toContain('1995-06-15');
    expect(sentryError.message).not.toContain('minji@example.com');
    expect(consoleErrorArg?.message).not.toContain('1995-06-15');
    expect(consoleErrorArg?.message).not.toContain('minji@example.com');
    expect(sentryError.message).toContain('birth_date=[redacted]');
    expect(consoleErrorArg?.message).toContain('birth_date=[redacted]');
  });

  it('global-error reports sanitized errors to Sentry', async () => {
    const error = new Error('global failed relation_nickname="민지" birth_time=10:30');

    render(<GlobalError error={error} reset={vi.fn()} />);

    await waitFor(() => expect(sentryMocks.captureException).toHaveBeenCalled());
    const sentryError = sentryMocks.captureException.mock.calls[0]?.[0] as Error;

    expect(sentryError.message).not.toContain('민지');
    expect(sentryError.message).not.toContain('10:30');
    expect(sentryError.message).toContain('relation_nickname=[redacted]');
    expect(sentryError.message).toContain('birth_time=[redacted]');
  });
});

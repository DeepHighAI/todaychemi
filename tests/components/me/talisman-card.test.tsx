// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithIntl } from '../../utils/render-with-intl';
import { TalismanCard } from '@/components/me/talisman-card';
import type { LedgerEntry, WalletBalance } from '@/types/wallet';

const BALANCE: WalletBalance = {
  balance: 18,
  next_expiry_at: '2026-07-15T12:00:00Z',
  next_expiry_amount: 10,
  monthly_used: 6,
  monthly_buckets: [1, 2, 0, 3, 1, 0, 2],
};

function ledgerRow(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    ledger_id: 'l1',
    user_id: 'u1',
    delta: -1,
    balance_after: 18,
    reason: 'hapcard_use',
    reference_id: 'ref1',
    created_at: '2026-06-01T12:00:00Z',
    ...overrides,
  };
}

describe('TalismanCard', () => {
  it('잔액·단위·최근 사용량을 렌더한다', () => {
    renderWithIntl(<TalismanCard balance={BALANCE} ledger={[]} />);

    expect(screen.getByText('부적 지갑')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('-6 부적')).toBeInTheDocument();
    // 만료일 라벨 (연도는 타임존 무관하게 안정)
    expect(screen.getByText(/다음 만료일 2026\./)).toBeInTheDocument();
  });

  it('사용 기록 토글이 원장 행을 펼치고 접는다', () => {
    renderWithIntl(<TalismanCard balance={BALANCE} ledger={[ledgerRow()]} />);

    const toggle = screen.getByRole('button', { name: /사용 기록/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('케미카드')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('케미카드')).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('원장이 비면 빈 기록 안내를 보여준다', () => {
    renderWithIntl(<TalismanCard balance={BALANCE} ledger={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /사용 기록/ }));
    expect(screen.getByText('아직 사용 기록이 없어요.')).toBeInTheDocument();
  });

  it('사유 코드를 오늘케미 한글 라벨로 매핑한다', () => {
    renderWithIntl(
      <TalismanCard
        balance={BALANCE}
        ledger={[
          ledgerRow({ ledger_id: 'a', reason: 'hapcard_use' }),
          ledgerRow({ ledger_id: 'b', reason: 'replay_use' }),
          ledgerRow({ ledger_id: 'c', reason: 'whatif_use' }),
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /사용 기록/ }));

    expect(screen.getByText('케미카드')).toBeInTheDocument();
    expect(screen.getByText('케미 다시 맞추기')).toBeInTheDocument();
    expect(screen.getByText('또 다른 나')).toBeInTheDocument();
  });

  it('증감 부호를 +/- 로 표기한다', () => {
    renderWithIntl(
      <TalismanCard
        balance={BALANCE}
        ledger={[
          ledgerRow({ ledger_id: 'p', reason: 'bonus', delta: 10, balance_after: 28 }),
          ledgerRow({ ledger_id: 'm', reason: 'hapcard_use', delta: -1, balance_after: 27 }),
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /사용 기록/ }));

    expect(screen.getByText('+10 부적')).toBeInTheDocument();
    expect(screen.getByText('-1 부적')).toBeInTheDocument();
  });
});

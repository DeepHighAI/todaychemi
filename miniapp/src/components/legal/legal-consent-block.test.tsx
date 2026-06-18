import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/test/render';
import { LegalConsentBlock } from './legal-consent-block';

const EMPTY = { terms: false, privacy: false, age: false };

describe('LegalConsentBlock', () => {
  it('필수 동의 3개 체크박스를 렌더한다', () => {
    renderWithProviders(
      <LegalConsentBlock value={EMPTY} onChange={vi.fn()} onViewDocument={vi.fn()} />,
    );
    expect(screen.getByRole('checkbox', { name: '이용약관에 동의합니다' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: '개인정보처리방침에 동의합니다' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: '만 14세 이상입니다' })).not.toBeChecked();
  });

  it('체크박스 클릭 시 해당 키만 true 로 onChange 한다', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <LegalConsentBlock value={EMPTY} onChange={onChange} onViewDocument={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole('checkbox', { name: '이용약관에 동의합니다' }));
    expect(onChange).toHaveBeenCalledWith({ terms: true, privacy: false, age: false });
  });

  it('약관/개인정보 "보기" 클릭 시 onViewDocument(slug) 를 호출한다', async () => {
    const onViewDocument = vi.fn();
    renderWithProviders(
      <LegalConsentBlock value={EMPTY} onChange={vi.fn()} onViewDocument={onViewDocument} />,
    );
    await userEvent.click(screen.getByRole('button', { name: '이용약관' }));
    expect(onViewDocument).toHaveBeenCalledWith('terms');
    await userEvent.click(screen.getByRole('button', { name: '개인정보처리방침' }));
    expect(onViewDocument).toHaveBeenCalledWith('privacy');
  });

  it('checked 값을 반영한다', () => {
    renderWithProviders(
      <LegalConsentBlock
        value={{ terms: true, privacy: true, age: true }}
        onChange={vi.fn()}
        onViewDocument={vi.fn()}
      />,
    );
    expect(screen.getByRole('checkbox', { name: '이용약관에 동의합니다' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '만 14세 이상입니다' })).toBeChecked();
  });
});

import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render';
import { RelationsNewPage } from './RelationsNewPage';

describe('RelationsNewPage', () => {
  it('route-level 100dvh/paddingBottom 중복 여백을 두지 않는다', () => {
    const { container } = renderWithProviders(<RelationsNewPage />);
    const main = container.querySelector('main');

    expect(main?.style.minHeight).toBe('100%');
    expect(main?.style.paddingBottom).toBe('');
  });
});

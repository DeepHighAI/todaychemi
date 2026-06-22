import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';

import { renderWithProviders } from '@/test/render';
import { WhatifTrigger } from './whatif-trigger';

describe('WhatifTrigger', () => {
  it('주요 CTA 는 테마 안전 foreground 토큰을 사용한다', () => {
    renderWithProviders(<WhatifTrigger />);
    const trigger = screen.getByRole('button', { name: '또 다른 나' });

    expect(trigger.style.backgroundColor).toContain('var(--primary)');
    expect(trigger.style.color).toContain('var(--primary-foreground)');
  });

  it('vaul WhatifSheet 를 열고 선택한 모드 라우트로 이동한다', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/" element={<WhatifTrigger />} />
        <Route path="/whatif/work" element={<p>WORK_SCREEN</p>} />
      </Routes>,
    );

    await user.click(screen.getByRole('button', { name: '또 다른 나' }));
    await user.click(await screen.findByRole('button', { name: '일할 때 나' }));

    expect(await screen.findByText('WORK_SCREEN')).toBeInTheDocument();
  });
});

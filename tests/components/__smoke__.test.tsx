// @vitest-environment jsdom

import { expect, test } from 'vitest';
import { render } from '@testing-library/react';

// jsdom 환경 동작 확인용 smoke test
test('jsdom 환경에서 DOM 렌더링이 가능해야 한다', () => {
  const { container } = render(<div data-testid="smoke">smoke</div>);
  expect(container.querySelector('[data-testid="smoke"]')).toBeInTheDocument();
});

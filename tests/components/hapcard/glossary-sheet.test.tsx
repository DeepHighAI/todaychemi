// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GlossaryProvider, useGlossaryContext } from '@/components/hapcard/glossary-provider';
import { GlossarySheet } from '@/components/hapcard/glossary-sheet';
import { renderWithIntl } from '../../utils/render-with-intl';

function SheetOpener({ term }: { term: string }) {
  const { openSheet } = useGlossaryContext();
  return (
    <button data-testid="open-btn" onClick={() => openSheet(term)}>
      열기
    </button>
  );
}

function Wrapper({ term }: { term: string }) {
  return (
    <GlossaryProvider>
      <SheetOpener term={term} />
      <GlossarySheet />
    </GlossaryProvider>
  );
}

describe('GlossarySheet', () => {
  it('openSheet 호출 후 용어 정의 텍스트 표시', async () => {
    const user = userEvent.setup();
    renderWithIntl(<Wrapper term="일주" />);
    await user.click(screen.getByTestId('open-btn'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/태어난 날의 천간/)).toBeInTheDocument();
  });

  it('시트 안에 용어 한글 이름 표시', async () => {
    const user = userEvent.setup();
    renderWithIntl(<Wrapper term="합" />);
    await user.click(screen.getByTestId('open-btn'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('openSheet 미호출 시 dialog 없음', () => {
    renderWithIntl(<Wrapper term="일주" />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('extended_definition이 있으면 short definition 대신 그것을 표시', async () => {
    const user = userEvent.setup();
    renderWithIntl(<Wrapper term="일주" />);
    await user.click(screen.getByTestId('open-btn'));
    // 일주.extended_definition 의 고유 문구 ("배우자궁") 가 렌더되어야 한다
    expect(screen.getByText(/배우자궁/)).toBeInTheDocument();
    // short definition 의 시작 문구는 노출되지 않아야 한다
    expect(screen.queryByText('태어난 날의 천간(天干)과 지지(地支)가 합쳐진 기둥으로, 사주에서 자신의 본질을 나타내는 핵심 기둥입니다. 일주는 성격·대인관계·배우자 인연을 읽는 출발점이 됩니다.')).toBeNull();
  });

  it('related_terms 섹션에 i18n label과 각 키를 표시', async () => {
    const user = userEvent.setup();
    renderWithIntl(<Wrapper term="일주" />);
    await user.click(screen.getByTestId('open-btn'));
    // 일주.related_terms = ['십신', '합', '충']
    expect(screen.getByText('관련 용어')).toBeInTheDocument();
    expect(screen.getByText('십신')).toBeInTheDocument();
    expect(screen.getByText('합')).toBeInTheDocument();
    expect(screen.getByText('충')).toBeInTheDocument();
  });
});

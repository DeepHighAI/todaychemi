// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LegalMarkdown } from '@/components/legal/legal-markdown';

describe('LegalMarkdown', () => {
  it('마크다운 제목·문단·리스트를 시맨틱 요소로 렌더한다', () => {
    render(
      <LegalMarkdown markdown={'# 이용약관\n\n## 제1조\n\n서비스 본문 문단입니다.\n\n- 첫째 항목\n- 둘째 항목'} />,
    );

    expect(screen.getByRole('heading', { level: 1, name: '이용약관' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '제1조' })).toBeInTheDocument();
    expect(screen.getByText('서비스 본문 문단입니다.')).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['첫째 항목', '둘째 항목']);
  });

  it('내부 링크는 새 탭으로 열지 않고 외부 링크는 새 탭(noreferrer)으로 연다', () => {
    render(
      <LegalMarkdown markdown={'[내부 약관](/legal/terms) 그리고 [외부 사이트](https://example.com)'} />,
    );

    const internal = screen.getByRole('link', { name: '내부 약관' });
    expect(internal).toHaveAttribute('href', '/legal/terms');
    expect(internal).not.toHaveAttribute('target');

    const external = screen.getByRole('link', { name: '외부 사이트' });
    expect(external).toHaveAttribute('href', 'https://example.com');
    expect(external).toHaveAttribute('target', '_blank');
    expect(external).toHaveAttribute('rel', 'noreferrer');
  });

  it('GFM 테이블을 table 요소로 렌더한다', () => {
    render(
      <LegalMarkdown markdown={'| 항목 | 값 |\n| --- | --- |\n| 보관기간 | 30일 |'} />,
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '항목' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '보관기간' })).toBeInTheDocument();
  });
});

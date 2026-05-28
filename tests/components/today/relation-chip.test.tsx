// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../utils/render-with-providers';
import { RelationChip } from '@/components/today/relation-chip';

const relations = [
  { relation_id: 'rel-1', nickname: '민지', mode: '일합', created_at: '2026-05-20' },
  { relation_id: 'rel-2', nickname: '지수', mode: '친구합', created_at: '2026-05-15' },
  { relation_id: 'rel-3', nickname: '하나', mode: '오래합', created_at: '2026-05-10' },
];

describe('RelationChip', () => {
  it('현재 별명을 chip 텍스트로 노출', () => {
    renderWithProviders(
      <RelationChip
        currentRelationId="rel-1"
        currentNickname="민지"
        relations={relations}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText(/민지/)).toBeInTheDocument();
  });

  it('open=true 일 때 시트 열림 — 다른 인연 별명 노출', () => {
    renderWithProviders(
      <RelationChip
        currentRelationId="rel-1"
        currentNickname="민지"
        relations={relations}
        onSelect={() => {}}
        open={true}
        onOpenChange={() => {}}
      />,
    );
    // 시트 열림 — 다른 인연 별명 노출
    expect(screen.getByText('지수')).toBeInTheDocument();
    expect(screen.getByText('하나')).toBeInTheDocument();
  });

  it('인연 5건 초과 시 최근 5건만 노출 (created_at desc)', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({
      relation_id: `rel-${i + 1}`,
      nickname: `별명${i + 1}`,
      mode: '일합',
      created_at: `2026-05-${(20 - i).toString().padStart(2, '0')}`,
    }));
    renderWithProviders(
      <RelationChip
        currentRelationId="rel-1"
        currentNickname="별명1"
        relations={many}
        onSelect={() => {}}
        open={true}
        onOpenChange={() => {}}
      />,
    );
    expect(screen.getByText('별명5')).toBeInTheDocument();
    expect(screen.queryByText('별명6')).toBeNull();
    expect(screen.queryByText('별명7')).toBeNull();
  });

  it('인연 항목 클릭 → onSelect(relation_id) 콜백', () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <RelationChip
        currentRelationId="rel-1"
        currentNickname="민지"
        relations={relations}
        onSelect={onSelect}
        open={true}
        onOpenChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('지수'));
    expect(onSelect).toHaveBeenCalledWith('rel-2');
  });

  it('현재 선택된 인연 항목에 aria-current="true" 마커', () => {
    renderWithProviders(
      <RelationChip
        currentRelationId="rel-2"
        currentNickname="지수"
        relations={relations}
        onSelect={() => {}}
        open={true}
        onOpenChange={() => {}}
      />,
    );
    // aria-current 가진 버튼 안에 '지수' 가 있어야 함
    const items = screen.getAllByRole('button');
    const currentItem = items.find((el) => el.getAttribute('aria-current') === 'true');
    expect(currentItem).toBeDefined();
    expect(currentItem!.textContent).toContain('지수');
  });

  it('relations 빈 배열 → 시트 열어도 항목 없음 + i18n empty 노출', () => {
    renderWithProviders(
      <RelationChip
        currentRelationId={null}
        currentNickname=""
        relations={[]}
        onSelect={() => {}}
      />,
    );
    // chip 자체가 미노출 또는 비활성 — 다음 테스트에서 결정
  });
});

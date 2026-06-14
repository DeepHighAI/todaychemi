/**
 * relation-chip.tsx — hero 내부 인연 chip 드롭다운 (미니앱 포트)
 *
 * 웹앱 원본: src/components/today/relation-chip.tsx
 * 변경 사항:
 *  - 'use client' 제거
 *  - next/link → react-router <Link to>
 *  - vaul Drawer 유지 (miniapp package.json 에 vaul 설치됨)
 *  - @/ 경로 → 상대 경로
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Drawer } from 'vaul';
import { Check, ChevronDown, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { RelationChipItem } from '../../types/relation';

interface RelationChipProps {
  currentRelationId: string | null;
  currentNickname: string;
  relations: RelationChipItem[];
  onSelect: (relationId: string) => void;
  /** 테스트/외부 제어용 controlled prop */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const MAX_LIST = 5;

export function RelationChip({
  currentRelationId,
  currentNickname,
  relations,
  onSelect,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: RelationChipProps) {
  const t = useTranslations('home');
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (next: boolean) => {
    if (onOpenChangeProp) onOpenChangeProp(next);
    else setOpenState(next);
  };

  // 최근 등록순 + 5건 컷
  const sorted = [...relations].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  const visible = sorted.slice(0, MAX_LIST);

  const handleSelect = (relationId: string) => {
    onSelect(relationId);
    setOpen(false);
  };

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <button
          type="button"
          aria-label={`${t('with_relation.chip_prefix')} ${currentNickname}${t('with_relation.chip_suffix')}`}
          style={{
            marginTop: 6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            maxWidth: 200,
            background: 'rgba(255,255,255,0.2)',
            color: 'white',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 'var(--r-pill)',
            padding: '4px 10px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
            {t('with_relation.chip_prefix')} {currentNickname}
            {t('with_relation.chip_suffix')}
          </span>
          <ChevronDown size={14} aria-hidden style={{ flexShrink: 0 }} />
        </button>
      </Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Overlay style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.4)' }} />
        <Drawer.Content
          aria-describedby={undefined}
          style={{
            position: 'fixed',
            insetInline: 0,
            bottom: 0,
            zIndex: 50,
            display: 'flex',
            maxHeight: '80vh',
            flexDirection: 'column',
            overflow: 'hidden',
            borderTopLeftRadius: 'var(--r-xl)',
            borderTopRightRadius: 'var(--r-xl)',
            backgroundColor: 'var(--background)',
          }}
        >
          {/* 드래그 핸들 */}
          <div style={{ margin: '8px auto 0', height: 6, width: 48, borderRadius: 'var(--r-pill)', background: 'var(--surface-2)' }} />

          {/* 헤더 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px' }}>
            <Drawer.Title style={{ font: 'var(--t-h3)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              {t('with_relation.menu_title')}
            </Drawer.Title>
            <Drawer.Close asChild>
              <button
                type="button"
                aria-label={t('with_relation.close_label')}
                style={{
                  display: 'flex',
                  width: 36,
                  height: 36,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  background: 'var(--surface-2)',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                }}
              >
                <X size={20} />
              </button>
            </Drawer.Close>
          </div>

          {/* 인연 목록 */}
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', padding: '0 12px 12px', margin: 0, listStyle: 'none' }}>
            {visible.map((rel) => {
              const isCurrent = rel.relation_id === currentRelationId;
              return (
                <li key={rel.relation_id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(rel.relation_id)}
                    aria-current={isCurrent ? 'true' : undefined}
                    style={{
                      display: 'flex',
                      width: '100%',
                      alignItems: 'center',
                      gap: 12,
                      borderRadius: 'var(--r-md)',
                      padding: 12,
                      textAlign: 'left',
                      border: isCurrent ? '1px solid var(--primary)' : '1px solid transparent',
                      background: isCurrent ? 'rgba(103,80,164,0.1)' : 'var(--card)',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rel.nickname}
                      </span>
                      {rel.mode && (
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {rel.mode}
                        </span>
                      )}
                    </span>
                    {isCurrent && <Check size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* 전체 보기 링크 */}
          <div style={{ borderTop: '1px solid var(--border)', padding: '12px 20px' }}>
            <Link
              to="/feed"
              onClick={() => setOpen(false)}
              style={{ display: 'block', textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--primary)', textDecoration: 'none' }}
            >
              {t('with_relation.view_all')}
            </Link>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

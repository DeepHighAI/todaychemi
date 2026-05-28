'use client';

/**
 * RelationChip — hero 내부 인연 chip 인터랙티브 드롭다운 (G2 / Phase 3 F2)
 *
 * 동작:
 *  - chip 클릭 → vaul Drawer (바텀시트) 열림
 *  - 사용자의 최근 인연 5건 목록 + "전체 보기 → /feed" CTA
 *  - 인연 클릭 → onSelect(relationId) 호출 → URL `?relation_id=...` 업데이트 (caller 책임)
 *  - 현재 인연에는 ✓ 마커 + aria-current="true"
 *
 * 데이터 소스: relations props (today-page-client 가 relationsQuery 결과 전달).
 */

import { useState } from 'react';
import Link from 'next/link';
import { Drawer } from 'vaul';
import { Check, ChevronDown, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface RelationChipItem {
  relation_id: string;
  nickname: string;
  mode: string | null;
  created_at: string;
}

interface RelationChipProps {
  currentRelationId: string | null;
  currentNickname: string;
  relations: RelationChipItem[];
  onSelect: (relationId: string) => void;
  /** 테스트 / 외부 제어용 controlled prop (생략 시 내부 state 사용) */
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

  // 최근 등록순 정렬 + 5건 컷
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
          /* Task 3 (393px QA): max-w + truncate 로 긴 닉네임 overflow 방지.
             393px hero 콘텐츠 폭 321px 안에서 좌측 column(min-w-0) + 우측 delta pill(shrink-0)
             공유. chip 본인은 200px 까지 — 한국어 8~10자 또는 영문 14~16자 안전. */
          className="mt-1.5 inline-flex items-center gap-1 max-w-[200px] bg-white/20 text-white text-[12px] font-semibold rounded-full px-2.5 py-1 active:scale-[0.97] transition-transform"
        >
          <span className="truncate min-w-0">
            {t('with_relation.chip_prefix')} {currentNickname}
            {t('with_relation.chip_suffix')}
          </span>
          <ChevronDown size={14} aria-hidden className="shrink-0" />
        </button>
      </Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col overflow-hidden rounded-t-[var(--r-xl)] bg-background"
        >
          <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-[var(--surface-2)]" />
          <div className="flex items-center justify-between px-5 pb-3 pt-4">
            <Drawer.Title className="text-base font-extrabold text-foreground">
              {t('with_relation.menu_title')}
            </Drawer.Title>
            <Drawer.Close asChild>
              <button
                type="button"
                aria-label={t('with_relation.close_label')}
                className="flex size-9 items-center justify-center rounded-full bg-[var(--surface-2)]"
              >
                <X size={20} />
              </button>
            </Drawer.Close>
          </div>

          <ul className="space-y-1 overflow-y-auto px-3 pb-3">
            {visible.map((rel) => {
              const isCurrent = rel.relation_id === currentRelationId;
              return (
                <li key={rel.relation_id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(rel.relation_id)}
                    aria-current={isCurrent ? 'true' : undefined}
                    className={`flex w-full items-center gap-3 rounded-[var(--r-md)] p-3 text-left transition ${
                      isCurrent
                        ? 'bg-primary/10 border border-primary'
                        : 'bg-card hover:bg-[var(--surface-2)]'
                    }`}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] font-semibold text-foreground truncate">
                        {rel.nickname}
                      </span>
                      {rel.mode && (
                        <span className="block text-[12px] text-muted-foreground truncate">
                          {rel.mode}
                        </span>
                      )}
                    </span>
                    {isCurrent && <Check size={18} className="text-primary shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="border-t px-5 py-3">
            <Link
              href="/feed"
              onClick={() => setOpen(false)}
              className="block text-center text-[13px] font-bold text-primary"
            >
              {t('with_relation.view_all')}
            </Link>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { Pencil, Trash2 } from 'lucide-react';
import type { MemoItem } from '@/types/memo';

interface MemoListProps {
  items: MemoItem[];
  onEdit: (memo: MemoItem) => void;
  onDelete: (memoId: string) => void;
}

export function MemoList({ items, onEdit, onDelete }: MemoListProps) {
  const t = useTranslations('relations.detail.memos');

  return (
    <div data-testid="memo-list" className="space-y-2">
      <p className="font-eyebrow text-muted-foreground">{t('title')}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((memo) => (
            <li
              key={memo.memo_id}
              data-testid={`memo-row-${memo.memo_id}`}
              className="rounded-xl bg-card p-3 flex items-start gap-2"
            >
              <p className="flex-1 text-sm text-foreground break-words">{memo.body}</p>
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  aria-label={t('edit')}
                  onClick={() => onEdit(memo)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  aria-label={t('delete')}
                  onClick={() => onDelete(memo.memo_id)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-[var(--warn)]"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

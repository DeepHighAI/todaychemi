/**
 * MemoSection.tsx — 인연 디테일 메모 목록 + 추가/수정 시트 (미니앱 포트)
 *
 * 웹앱 원본: src/components/memo/memo-list.tsx + memo-sheet.tsx
 * 변경: 'use client' 제거, lucide-react Pencil/Trash2 → 인라인 SVG,
 *       Tailwind → 인라인 스타일, next-intl useTranslations 유지,
 *       drawer.tsx 미니앱 포트 사용.
 *
 * LOCKED (island.md:183): 메모 CRUD 는 compat_score 에 0 영향 보장.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Pencil, Trash2 } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import type { MemoItem } from '@/types/relation';

// -----------------------------------------------------------------------
// MemoList (인라인)
// -----------------------------------------------------------------------

interface MemoListProps {
  items: MemoItem[];
  onEdit: (memo: MemoItem) => void;
  onDelete: (memoId: string) => void;
}

function MemoList({ items, onEdit, onDelete }: MemoListProps) {
  const t = useTranslations('relations.detail.memos');

  return (
    <div data-testid="memo-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)' }}>
        {t('title')}
      </p>
      {items.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, color: 'var(--muted-foreground)' }}>{t('empty')}</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((memo) => (
            <li
              key={memo.memo_id}
              data-testid={`memo-row-${memo.memo_id}`}
              style={{
                borderRadius: 'var(--r-md)',
                backgroundColor: 'var(--surface-1)',
                padding: 12,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <p
                style={{
                  flex: 1,
                  margin: 0,
                  fontSize: 14,
                  color: 'var(--foreground)',
                  wordBreak: 'break-word',
                }}
              >
                {memo.body}
              </p>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button
                  type="button"
                  aria-label={t('edit')}
                  onClick={() => onEdit(memo)}
                  style={{
                    minHeight: 44,
                    minWidth: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--muted-foreground)',
                  }}
                >
                  <Pencil size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={t('delete')}
                  onClick={() => onDelete(memo.memo_id)}
                  style={{
                    minHeight: 44,
                    minWidth: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--muted-foreground)',
                  }}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------
// MemoSheet (인라인)
// -----------------------------------------------------------------------

const MEMO_BODY_MAX = 80;

interface MemoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initialBody?: string;
  onSubmit: (body: string) => void;
  submitting?: boolean;
}

function MemoSheet({
  open,
  onOpenChange,
  mode,
  initialBody = '',
  onSubmit,
  submitting = false,
}: MemoSheetProps) {
  const t = useTranslations('relations.detail.memos');
  const [body, setBody] = useState(initialBody);

  const count = [...body].length;
  const isEmpty = body.trim().length === 0;

  function handleSubmit() {
    if (!isEmpty && !submitting) onSubmit(body.trim());
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            {mode === 'create' ? t('sheet.createTitle') : t('sheet.editTitle')}
          </DrawerTitle>
          <DrawerDescription style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>
            {t('sheet.description')}
          </DrawerDescription>
        </DrawerHeader>
        <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            data-testid="memo-sheet-input"
            rows={4}
            maxLength={MEMO_BODY_MAX}
            placeholder={t('sheet.placeholder')}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            style={{
              width: '100%',
              resize: 'none',
              borderRadius: 'var(--r-md)',
              backgroundColor: 'var(--surface-1)',
              padding: 12,
              fontSize: 14,
              color: 'var(--foreground)',
              border: 'none',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <p
            data-testid="memo-sheet-counter"
            style={{
              margin: 0,
              fontSize: 12,
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
              color: count >= 70 ? 'var(--warn)' : 'var(--muted-foreground)',
            }}
          >
            {count}/{MEMO_BODY_MAX}
          </p>
        </div>
        <DrawerFooter>
          <Button
            data-testid="memo-sheet-submit"
            size="lg"
            style={{ width: '100%' }}
            disabled={isEmpty || submitting}
            onClick={handleSubmit}
          >
            {submitting ? t('sheet.submitting') : t('sheet.submit')}
          </Button>
          <DrawerClose asChild>
            <Button variant="outline" size="lg" style={{ width: '100%' }} onClick={() => onOpenChange(false)}>
              {t('sheet.cancel')}
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

// -----------------------------------------------------------------------
// MemoSection — MemoList + MemoSheet 조합 (인연 디테일 전용)
// -----------------------------------------------------------------------

interface MemoSectionProps {
  items: MemoItem[];
  onEdit: (body: string, memoId: string) => void;
  onCreate: (body: string) => void;
  onDelete: (memoId: string) => void;
  isSubmitting: boolean;
}

export function MemoSection({ items, onEdit, onCreate, onDelete, isSubmitting }: MemoSectionProps) {
  const t = useTranslations('relations.detail.memos');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingMemo, setEditingMemo] = useState<MemoItem | null>(null);

  function openEditSheet(memo: MemoItem) {
    setEditingMemo(memo);
    setSheetOpen(true);
  }

  function openCreateSheet() {
    setEditingMemo(null);
    setSheetOpen(true);
  }

  function handleSubmit(body: string) {
    if (editingMemo) {
      onEdit(body, editingMemo.memo_id);
    } else {
      onCreate(body);
    }
    setSheetOpen(false);
    setEditingMemo(null);
  }

  return (
    <div
      style={{
        borderRadius: 'var(--r-lg)',
        backgroundColor: 'var(--card)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <MemoList items={items} onEdit={openEditSheet} onDelete={onDelete} />
      <Button
        type="button"
        variant="outline"
        size="lg"
        style={{ width: '100%' }}
        onClick={openCreateSheet}
      >
        {t('add')}
      </Button>

      {/* key 로 editingMemo 변경 시 remount → initialBody 초기화 */}
      <MemoSheet
        key={editingMemo ? editingMemo.memo_id : 'create'}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={editingMemo ? 'edit' : 'create'}
        initialBody={editingMemo?.body ?? ''}
        onSubmit={handleSubmit}
        submitting={isSubmitting}
      />
    </div>
  );
}

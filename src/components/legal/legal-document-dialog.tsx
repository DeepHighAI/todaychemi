'use client';

import { useEffect, useState } from 'react';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LegalMarkdown } from '@/components/legal/legal-markdown';
import type { LegalDocumentSlug } from '@/lib/legal/documents';

interface LegalDocumentDialogProps {
  slug: LegalDocumentSlug | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LegalDocumentResponse {
  title: string;
  version: string;
  markdown: string;
}

export function LegalDocumentDialog({ slug, open, onOpenChange }: LegalDocumentDialogProps) {
  const [state, setState] = useState<{
    slug: LegalDocumentSlug | null;
    document: LegalDocumentResponse | null;
    error: boolean;
  }>({ slug: null, document: null, error: false });
  const document = state.slug === slug ? state.document : null;
  const error = state.slug === slug && state.error;

  useEffect(() => {
    if (!open || !slug) return;

    const controller = new AbortController();

    fetch(`/api/legal/documents/${slug}`, {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error('LEGAL_DOCUMENT_FETCH_FAILED');
        return res.json() as Promise<LegalDocumentResponse>;
      })
      .then((nextDocument) => {
        setState({ slug, document: nextDocument, error: false });
      })
      .catch((err: unknown) => {
        if ((err as { name?: string }).name !== 'AbortError') {
          setState({ slug, document: null, error: true });
        }
      });

    return () => controller.abort();
  }, [open, slug]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[88vh] max-w-[min(720px,calc(100vw-2rem))] gap-0 overflow-hidden rounded-[var(--r-xl)] p-0"
      >
        <DialogHeader className="flex-row items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <DialogTitle className="text-base font-extrabold">
              {document?.title ?? (slug === 'privacy' ? '개인정보처리방침' : '이용약관')}
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs">
              {document ? `시행일 ${document.version}` : '문서를 불러오는 중입니다'}
            </DialogDescription>
          </div>
          <DialogClose
            render={
              <button
                type="button"
                className="min-h-11 shrink-0 rounded-[var(--r-sm)] px-3 text-sm font-bold text-primary hover:bg-[var(--surface-1)]"
              />
            }
          >
            닫기
          </DialogClose>
        </DialogHeader>

        <div className="max-h-[calc(88vh-78px)] overflow-y-auto px-5 py-4">
          {document ? (
            <LegalMarkdown markdown={document.markdown} />
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              {error ? '문서를 불러오지 못했어요. 잠시 후 다시 시도해주세요.' : '불러오는 중...'}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

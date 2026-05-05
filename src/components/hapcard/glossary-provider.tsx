'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

interface GlossaryContextValue {
  /** 용어를 소비하고 첫 등장 여부를 반환. 첫 호출 = true, 이후 = false. */
  consume: (term: string) => boolean;
  /** 용어 바텀시트를 열기 */
  openSheet: (term: string) => void;
  /** 용어 바텀시트를 닫기 */
  closeSheet: () => void;
  /** 현재 열린 바텀시트 용어 (null = 닫힘) */
  sheetTerm: string | null;
}

const GlossaryContext = createContext<GlossaryContextValue | null>(null);

export function GlossaryProvider({ children }: { children: React.ReactNode }) {
  const seenRef = useRef<Set<string>>(new Set());
  const [sheetTerm, setSheetTerm] = useState<string | null>(null);

  const consume = useCallback((term: string): boolean => {
    const isFirst = !seenRef.current.has(term);
    seenRef.current.add(term);
    return isFirst;
  }, []);

  const openSheet = useCallback((term: string) => {
    setSheetTerm(term);
  }, []);

  const closeSheet = useCallback(() => {
    setSheetTerm(null);
  }, []);

  return (
    <GlossaryContext.Provider value={{ consume, openSheet, closeSheet, sheetTerm }}>
      {children}
    </GlossaryContext.Provider>
  );
}

export function useGlossaryContext(): GlossaryContextValue {
  const ctx = useContext(GlossaryContext);
  if (!ctx) {
    throw new Error('useGlossaryContext: GlossaryProvider 가 없습니다');
  }
  return ctx;
}

export function useOptionalGlossaryContext(): GlossaryContextValue | null {
  return useContext(GlossaryContext);
}

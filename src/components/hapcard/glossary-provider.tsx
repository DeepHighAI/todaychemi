'use client';

import { createContext, useCallback, useContext, useRef } from 'react';

interface GlossaryContextValue {
  /** 용어를 소비하고 첫 등장 여부를 반환. 첫 호출 = true, 이후 = false. */
  consume: (term: string) => boolean;
}

const GlossaryContext = createContext<GlossaryContextValue | null>(null);

export function GlossaryProvider({ children }: { children: React.ReactNode }) {
  const seenRef = useRef<Set<string>>(new Set());

  const consume = useCallback((term: string): boolean => {
    const isFirst = !seenRef.current.has(term);
    seenRef.current.add(term);
    return isFirst;
  }, []);

  return (
    <GlossaryContext.Provider value={{ consume }}>
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

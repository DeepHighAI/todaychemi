/**
 * whatif-do-first.tsx — "일단 이거 해봐" 섹션 (미니앱 포트)
 *
 * 웹앱 원본: src/components/whatif/whatif-do-first.tsx
 * 변경: 'use client' 제거, 경로 재정렬.
 */

import { WhatifNumberedList } from './whatif-numbered-list';

interface WhatifDoFirstProps {
  items: readonly string[];
}

export function WhatifDoFirst({ items }: WhatifDoFirstProps) {
  return <WhatifNumberedList testid="whatif-do-first" titleKey="section.do_first" items={items} />;
}

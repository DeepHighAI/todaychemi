'use client';

import { WhatifNumberedList } from '@/components/whatif/whatif-numbered-list';

interface WhatifDoFirstProps {
  items: readonly string[];
}

export function WhatifDoFirst({ items }: WhatifDoFirstProps) {
  return <WhatifNumberedList testid="whatif-do-first" titleKey="section.do_first" items={items} />;
}

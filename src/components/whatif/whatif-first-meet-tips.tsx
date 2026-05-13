'use client';

import { WhatifNumberedList } from '@/components/whatif/whatif-numbered-list';

interface WhatifFirstMeetTipsProps {
  tips: readonly string[];
}

export function WhatifFirstMeetTips({ tips }: WhatifFirstMeetTipsProps) {
  return <WhatifNumberedList testid="whatif-first-meet-tips" titleKey="section.first_meet_tips" items={tips} />;
}

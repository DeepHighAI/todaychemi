/**
 * whatif-first-meet-tips.tsx — "처음 보는 나" 전용 TIP 섹션 (미니앱 포트)
 *
 * 웹앱 원본: src/components/whatif/whatif-first-meet-tips.tsx
 * 변경: 'use client' 제거, 경로 재정렬.
 */

import { WhatifNumberedList } from './whatif-numbered-list';

interface WhatifFirstMeetTipsProps {
  tips: readonly string[];
}

export function WhatifFirstMeetTips({ tips }: WhatifFirstMeetTipsProps) {
  return (
    <WhatifNumberedList testid="whatif-first-meet-tips" titleKey="section.first_meet_tips" items={tips} />
  );
}

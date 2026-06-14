/**
 * date-line.tsx — 날짜 + 일주 표시 줄 (미니앱 포트)
 *
 * 웹앱 원본: src/components/today/date-line.tsx
 * 변경 사항:
 *  - 'use client' 없음 (원본도 없음)
 *  - @/ 경로 → 상대 경로
 */

import { convertHanja } from '../../lib/glossary/post-process';

interface DateLineProps {
  date: string;
  dayPillar: string;
}

export function DateLine({ date, dayPillar }: DateLineProps) {
  return (
    <div
      data-testid="date-line"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 16px',
        font: 'var(--t-sub)',
        color: 'var(--text-secondary)',
      }}
    >
      <span>{date}</span>
      <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
        {convertHanja(dayPillar)}일
      </span>
    </div>
  );
}

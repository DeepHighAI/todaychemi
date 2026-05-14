import { convertHanja } from '@/lib/glossary/post-process';

interface DateLineProps {
  date: string;
  dayPillar: string;
}

export function DateLine({ date, dayPillar }: DateLineProps) {
  return (
    <div data-testid="date-line" className="flex items-center gap-2 px-4 text-sm text-muted-foreground">
      <span>{date}</span>
      <span className="font-medium text-foreground">{convertHanja(dayPillar)}일</span>
    </div>
  );
}

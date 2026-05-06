import { createHash } from 'node:crypto';
import type { ChartCore } from '@/types/chart';

export function buildSourcePacketHash(chart: ChartCore, targetDate: string): string {
  const packet = JSON.stringify({ chart, target_date: targetDate });
  return createHash('sha256').update(packet).digest('hex');
}

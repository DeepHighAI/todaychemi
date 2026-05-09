'use client';

import { usePathname } from 'next/navigation';
import { TabBar } from './tab-bar';

const HIDE_PATHS = ['/onboarding', '/relations/new'];

export function ConditionalTabBar() {
  const pathname = usePathname();
  if (HIDE_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) return null;
  return <TabBar />;
}

'use client';

/* TabBar — canvas pattern: active item gets pill background on icon
 * Canvas reference: type-d/primitives.jsx::TabBar + system.css .tabbar .ti.on .ic
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Home, Sparkles, User } from 'lucide-react';

const TAB_HREFS = [
  { href: '/',     key: 'home', Icon: Home },
  { href: '/feed', key: 'feed', Icon: Sparkles },
  { href: '/me',   key: 'me',   Icon: User },
] as const;

export function TabBar() {
  const pathname = usePathname();
  const t = useTranslations('nav.tab');

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 bg-background border-t border-border"
      style={{ height: 76, paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-3 h-full pt-2">
        {TAB_HREFS.map(({ href, key, Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${
                isActive ? 'text-[var(--p-10)]' : 'text-muted-foreground'
              }`}
            >
              {/* pill background on active (canvas: .tabbar .ti.on .ic { background: var(--p-90) }) */}
              <span
                className="flex items-center justify-center rounded-full transition-all"
                style={{
                  width: 56,
                  height: 28,
                  background: isActive ? 'var(--p-90)' : 'transparent',
                  color: isActive ? 'var(--p-10)' : 'inherit',
                }}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              </span>
              {t(key)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function TodayAppBar() {
  const t = useTranslations('home');
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // next-themes SSR hydration mismatch 방지
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  const isDark = mounted && resolvedTheme === 'dark';
  const Icon = isDark ? Sun : Moon;

  return (
    <div className="sticky top-0 z-40 bg-surface-1 flex items-center justify-between px-4 h-14">
      <h1 className="font-h3 text-foreground">{t('greeting')}</h1>
      <div className="flex items-center gap-2">
        <Link href="/relations/new" className="text-primary font-semibold text-sm">
          {t('add_relation')}
        </Link>
        <button
          type="button"
          aria-label={isDark ? t('theme_to_light') : t('theme_to_dark')}
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--on-surface)] shadow-[var(--e-1)] transition active:scale-[0.96]"
        >
          <Icon size={18} aria-hidden />
        </button>
      </div>
    </div>
  );
}

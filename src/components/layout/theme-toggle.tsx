'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const t = useTranslations('me.theme');

  // next-themes SSR hydration mismatch 방지 (false-positive: set-state-in-effect)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const items = [
    { value: 'light' as const, Icon: Sun, label: t('light') },
    { value: 'dark' as const, Icon: Moon, label: t('dark') },
    { value: 'system' as const, Icon: Monitor, label: t('system') },
  ];

  return (
    <div
      role="radiogroup"
      aria-label={t('label')}
      className="flex bg-[var(--surface-2)] rounded-[var(--r-md)] p-[3px] gap-[2px]"
    >
      {items.map(({ value, Icon, label }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-[13px] font-semibold rounded-[12px] transition ${
              active
                ? 'bg-[var(--surface)] text-[var(--on-surface)] shadow-[var(--e-1)]'
                : 'text-[var(--on-surface-var)]'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

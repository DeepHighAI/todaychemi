/**
 * theme-toggle-button.tsx — 홈 앱바 우측 라이트/다크 토글(2단계).
 *
 * 다크일 때 해(라이트로 전환), 라이트일 때 달(다크로 전환) 아이콘을 보인다.
 * 상태·전환은 use-preferences 스토어가 단일 출처로 관리한다.
 */

import { Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { usePreferences } from '@/lib/preferences/use-preferences';

export function ThemeToggleButton() {
  const t = useTranslations('home');
  const resolvedTheme = usePreferences((s) => s.resolvedTheme);
  const toggleTheme = usePreferences((s) => s.toggleTheme);

  const isDark = resolvedTheme === 'dark';
  const label = isDark ? t('theme_to_light') : t('theme_to_dark');

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        // iOS/TDS 최소 탭 타깃 44pt 충족
        width: 44,
        height: 44,
        borderRadius: 'var(--r-pill)',
        border: 'none',
        background: 'transparent',
        color: 'var(--primary)',
        cursor: 'pointer',
      }}
    >
      {isDark ? <Sun size={22} aria-hidden="true" /> : <Moon size={22} aria-hidden="true" />}
    </button>
  );
}

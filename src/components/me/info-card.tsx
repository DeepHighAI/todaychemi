'use client';

import { ChevronRight, FileText, Globe2, Info, Mail, Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface InfoCardProps {
  onPrivacy: () => void;
  onTerms: () => void;
  onAbout: () => void;
  onLang: () => void;
}

export function InfoCard({ onPrivacy, onTerms, onAbout, onLang }: InfoCardProps) {
  const t = useTranslations('me.info');

  return (
    <section
      data-testid="info-card"
      className="overflow-hidden rounded-[var(--r-md)] border border-border bg-card"
    >
      <div className="px-4 pb-1 pt-3">
        <p className="text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground">
          {t('eyebrow')}
        </p>
      </div>
      <InfoRow Icon={Globe2} label={t('language')} sub={t('languageSub')} onClick={onLang} />
      <InfoRow Icon={Shield} label={t('privacy')} sub={t('privacySub')} onClick={onPrivacy} />
      <InfoRow Icon={FileText} label={t('terms')} sub={t('termsSub')} onClick={onTerms} />
      <InfoRow Icon={Info} label={t('about')} sub={t('aboutSub')} onClick={onAbout} />
      <InfoRow Icon={Mail} label={t('contact')} sub="02 3443 1028" href="tel:0234431028" />
    </section>
  );
}

function InfoRow({
  Icon,
  label,
  sub,
  onClick,
  href,
}: {
  Icon: React.ComponentType<{ size?: number }>;
  label: string;
  sub: string;
  onClick?: () => void;
  href?: string;
}) {
  const content = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-[var(--surface-2)] text-primary">
        <Icon size={19} />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-sm font-bold text-foreground">{label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{sub}</span>
      </span>
      <ChevronRight size={18} className="text-muted-foreground" />
    </>
  );
  const className = 'flex w-full items-center gap-3 border-t border-[var(--hairline)] px-4 py-3.5';
  if (href) {
    return <a href={href} className={className}>{content}</a>;
  }
  return <button type="button" onClick={onClick} className={className}>{content}</button>;
}

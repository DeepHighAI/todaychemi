'use client';

import { useState } from 'react';
import { Drawer } from 'vaul';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { MeUpdateRequest } from '@/types/me';
import { BirthDateField } from '@/components/picker/birth-date-field';
import { BirthTimeField } from '@/components/picker/birth-time-field';

type TimeAccuracy = 'exact' | 'approximate' | 'unknown';
type Gender = 'M' | 'F' | '';
type Calendar = 'solar' | 'lunar';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProfileData {
  nickname: string;
  birth_date: string;
  birth_date_calendar: Calendar;
  is_lunar_leap: boolean;
  birth_time_knowledge: TimeAccuracy;
  birth_time: string | null;
  gender: 'M' | 'F';
}

type FormState = {
  nickname: string;
  birthDate: string;
  calendar: Calendar;
  gender: Gender;
  knowledge: TimeAccuracy;
  birthTime: string;
};

async function fetchProfile(): Promise<ProfileData> {
  const res = await fetch('/api/me');
  if (!res.ok) throw new Error('PROFILE_FETCH_FAILED');
  const body = (await res.json()) as { ok: boolean; profile: ProfileData };
  return body.profile;
}

async function patchProfile(body: MeUpdateRequest): Promise<void> {
  const res = await fetch('/api/me', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('PATCH_FAILED');
}

// 내부 폼 — profile을 초기값으로 받아 useState 초기화, useEffect 없음
function MeEditForm({
  initial,
  onSuccess,
  onError,
}: {
  initial: ProfileData;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const tOb = useTranslations('onboarding');
  const t = useTranslations('me.edit');
  const qc = useQueryClient();

  const [form, setForm] = useState<FormState>({
    nickname: initial.nickname,
    birthDate: initial.birth_date,
    calendar: initial.birth_date_calendar,
    gender: initial.gender,
    knowledge: initial.birth_time_knowledge,
    birthTime: initial.birth_time ?? '',
  });

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  const mutation = useMutation({
    mutationFn: patchProfile,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['me-chart'] });
      void qc.invalidateQueries({ queryKey: ['today'] });
      void qc.invalidateQueries({ queryKey: ['me-profile'] });
      onSuccess();
    },
    onError: () => onError(t('error.generic')),
  });

  function handleSave() {
    if (!form.nickname.trim()) return;
    mutation.mutate({
      nickname: form.nickname.trim(),
      birth_date: form.birthDate,
      birth_date_calendar: form.calendar,
      is_lunar_leap: false,
      birth_time_knowledge: form.knowledge,
      birth_time: form.knowledge === 'unknown' ? null : form.birthTime || null,
      gender: form.gender as 'M' | 'F',
    });
  }

  const canSave = form.nickname.trim().length > 0 && !mutation.isPending;

  return (
    <div className="overflow-y-auto px-4 pb-32 space-y-4">
      {/* 별명 */}
      <div>
        <label htmlFor="edit-nickname" className="block text-xs text-muted-foreground mb-1">
          {tOb('nickname.label')}
        </label>
        <input
          id="edit-nickname"
          aria-label={tOb('nickname.label')}
          type="text"
          placeholder={tOb('nickname.placeholder')}
          value={form.nickname}
          onChange={(e) => setField('nickname', e.target.value)}
          maxLength={20}
          className="w-full rounded-[var(--r-sm)] border border-border bg-[var(--surface-1)] px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* 생년월일 */}
      <BirthDateField
        label={tOb('birth.date')}
        value={form.birthDate}
        onChange={(v) => setField('birthDate', v)}
        portal={false}
      />

      {/* 양/음력 */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">{tOb('birth.calendar')}</p>
        <div className="flex gap-2" role="radiogroup">
          {([
            { value: 'solar', label: tOb('birth.calendarSolar') },
            { value: 'lunar', label: tOb('birth.calendarLunar') },
          ] as { value: Calendar; label: string }[]).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={form.calendar === value}
              onClick={() => setField('calendar', value)}
              className={`flex-1 rounded-[var(--r-pill)] px-4 py-3 text-sm font-semibold transition ${
                form.calendar === value
                  ? 'bg-[var(--p-40)] text-white'
                  : 'bg-[var(--surface-2)] text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 성별 */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">{tOb('gender.label')}</p>
        <div className="flex gap-2" role="radiogroup">
          {(['M', 'F'] as const).map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={form.gender === g}
              aria-label={g === 'M' ? tOb('gender.male') : tOb('gender.female')}
              onClick={() => setField('gender', g)}
              className={`flex-1 rounded-[var(--r-pill)] px-4 py-3 text-sm font-semibold transition ${
                form.gender === g
                  ? 'bg-[var(--p-40)] text-white'
                  : 'bg-[var(--surface-2)] text-foreground'
              }`}
            >
              {g === 'M' ? tOb('gender.male') : tOb('gender.female')}
            </button>
          ))}
        </div>
      </div>

      {/* 출생 시간 정확도 */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">{tOb('birth.time')}</p>
        <div className="flex gap-3" role="radiogroup">
          {([
            { value: 'exact', label: tOb('birth.timeAccuracy.exact') },
            { value: 'approximate', label: tOb('birth.timeAccuracy.estimated') },
            { value: 'unknown', label: tOb('birth.timeAccuracy.unknown') },
          ] as { value: TimeAccuracy; label: string }[]).map(({ value, label }) => (
            <label key={value} className="flex min-h-[44px] items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="edit-birth-time-knowledge"
                value={value}
                checked={form.knowledge === value}
                onChange={() => setField('knowledge', value)}
                aria-label={label}
                className="accent-primary"
              />
              <span className="text-sm text-foreground">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 출생 시간 */}
      {form.knowledge !== 'unknown' && (
        <BirthTimeField
          label={tOb('birth.timeOptional')}
          value={form.birthTime}
          onChange={(v) => setField('birthTime', v)}
          portal={false}
        />
      )}

      {/* 저장 버튼 */}
      <div className="fixed bottom-4 inset-x-4 max-w-md mx-auto z-50">
        <Button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          variant="default"
          className="h-11 w-full"
        >
          {mutation.isPending ? t('saving') : t('save')}
        </Button>
      </div>
    </div>
  );
}

// 외부 Drawer — 프로필 fetch 후 MeEditForm 조건부 렌더 (key로 profile 변경 시 폼 리셋)
export function MeEditDrawer({ open, onOpenChange }: Props) {
  const t = useTranslations('me.edit');
  const [error, setError] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ['me-profile'],
    queryFn: fetchProfile,
    enabled: open,
    staleTime: 0,
  });

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-[var(--r-xl)] bg-background max-h-[90vh]">
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-[var(--surface-2)]" />
          <div className="px-4 pt-4 pb-2">
            <Drawer.Title className="text-lg font-bold text-foreground">{t('title')}</Drawer.Title>
            <Drawer.Description className="sr-only">{t('description')}</Drawer.Description>
          </div>
          {error && (
            <p role="alert" className="px-4 text-center text-sm text-destructive">{error}</p>
          )}
          {profile ? (
            <MeEditForm
              key={profile.birth_date + profile.nickname}
              initial={profile}
              onSuccess={() => { setError(null); onOpenChange(false); }}
              onError={(msg) => setError(msg)}
            />
          ) : (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t('saving')}
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

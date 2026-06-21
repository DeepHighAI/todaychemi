/**
 * me-edit-drawer.tsx — 내 정보 수정 드로어 (미니앱 포트)
 *
 * 웹앱 원본: src/components/me/me-edit-drawer.tsx
 * 미니앱:
 *   - vaul Drawer 유지 (package.json 설치됨).
 *   - Tailwind → 인라인 스타일.
 *   - 생년월일/시간 = iOS 휠 피커(DateWheelField/TimeWheelField). WheelTray 는
 *     vaul 이 아닌 portal(document.body, z-index 200+)이라 본 드로어 위에 뜬다.
 *     min/max 는 다른 등록 화면과 동일하게 [1900-01-01, 오늘]로 보정.
 *   - fetch → apiFetch + useAuth 토큰 사용.
 *   - next/link → 제거(사용 없음), next-intl useTranslations 유지.
 */

import { useState } from 'react';
import { Drawer } from 'vaul';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Seg } from '@/components/ui/seg';
import { DateWheelField } from '@/components/ui/date-wheel-field';
import { TimeWheelField } from '@/components/ui/time-wheel-field';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

type TimeAccuracy = 'exact' | 'approximate' | 'unknown';
type Gender = 'M' | 'F';
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
  gender: Gender;
}

interface MeUpdateRequest {
  nickname: string;
  birth_date: string;
  birth_date_calendar: Calendar;
  is_lunar_leap: boolean;
  birth_time_knowledge: TimeAccuracy;
  birth_time: string | null;
  gender: Gender;
}

type FormState = {
  nickname: string;
  birthDate: string;
  calendar: Calendar;
  gender: Gender | '';
  knowledge: TimeAccuracy;
  birthTime: string;
};

// ---------------------------------------------------------------------------
// 폼 컴포넌트
// ---------------------------------------------------------------------------

function MeEditForm({
  initial,
  token,
  onSuccess,
  onError,
}: {
  initial: ProfileData;
  token: string | null;
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
    mutationFn: (body: MeUpdateRequest) =>
      apiFetch<void>('/api/me', { method: 'PATCH', body, token }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['me-chart'] });
      void qc.invalidateQueries({ queryKey: ['today'] });
      void qc.invalidateQueries({ queryKey: ['whatif'] });
      void qc.invalidateQueries({ queryKey: ['hapcard'] });
      void qc.invalidateQueries({ queryKey: ['me-profile'] });
      onSuccess();
    },
    onError: () => onError(t('error.generic')),
  });

  function handleSave() {
    if (!form.nickname.trim() || !form.gender) return;
    mutation.mutate({
      nickname: form.nickname.trim(),
      birth_date: form.birthDate,
      birth_date_calendar: form.calendar,
      is_lunar_leap: false,
      birth_time_knowledge: form.knowledge,
      birth_time: form.knowledge === 'unknown' ? null : form.birthTime || null,
      gender: form.gender as Gender,
    });
  }

  const canSave = form.nickname.trim().length > 0 && Boolean(form.gender) && !mutation.isPending;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    borderRadius: 'var(--r-sm)',
    border: '1px solid var(--hairline)',
    backgroundColor: 'var(--surface-1)',
    padding: '12px',
    fontSize: 14,
    color: 'var(--text-primary)',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ overflowY: 'auto', padding: '0 16px 128px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 별명 */}
      <div>
        <label
          htmlFor="edit-nickname"
          style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}
        >
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
          style={inputStyle}
        />
      </div>

      {/* 생년월일 — iOS 휠 피커 */}
      <div>
        <label
          htmlFor="edit-birth-date"
          style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}
        >
          {tOb('birth.date')}
        </label>
        <DateWheelField
          id="edit-birth-date"
          value={form.birthDate}
          onChange={(v) => setField('birthDate', v)}
          min="1900-01-01"
          max={new Date().toISOString().slice(0, 10)}
          label={tOb('birth.date')}
          placeholder={tOb('birth.datePlaceholder')}
        />
      </div>

      {/* 양/음력 */}
      <div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{tOb('birth.calendar')}</p>
        <Seg
          options={[
            { value: 'solar', label: tOb('birth.calendarSolar') },
            { value: 'lunar', label: tOb('birth.calendarLunar') },
          ]}
          value={form.calendar}
          onChange={(v) => setField('calendar', v)}
          variant="fill"
          ariaLabel={tOb('birth.calendar')}
        />
      </div>

      {/* 성별 */}
      <div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{tOb('gender.label')}</p>
        <Seg
          options={[
            { value: 'M', label: tOb('gender.male') },
            { value: 'F', label: tOb('gender.female') },
          ]}
          value={form.gender as 'M' | 'F'}
          onChange={(g) => setField('gender', g)}
          variant="fill"
          ariaLabel={tOb('gender.label')}
        />
      </div>

      {/* 출생 시간 정확도 */}
      <div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{tOb('birth.time')}</p>
        <Seg
          options={[
            { value: 'exact', label: tOb('birth.timeAccuracy.exact') },
            { value: 'approximate', label: tOb('birth.timeAccuracy.estimated') },
            { value: 'unknown', label: tOb('birth.timeAccuracy.unknown') },
          ]}
          value={form.knowledge}
          onChange={(v) => setField('knowledge', v)}
          variant="fill"
          columns={3}
          shape="rounded"
          outlined
          size="sm"
          ariaLabel={tOb('birth.time')}
        />
      </div>

      {/* 출생 시간 — iOS 휠 피커 */}
      {form.knowledge !== 'unknown' && (
        <div>
          <label
            htmlFor="edit-birth-time"
            style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}
          >
            {tOb('birth.timeOptional')}
          </label>
          <TimeWheelField
            id="edit-birth-time"
            value={form.birthTime}
            onChange={(v) => setField('birthTime', v)}
            label={tOb('birth.timeOptional')}
            placeholder={tOb('birth.timePlaceholder')}
          />
        </div>
      )}

      {/* 저장 버튼 (고정 하단) */}
      <div
        style={{
          position: 'fixed',
          bottom: 16,
          left: 16,
          right: 16,
          maxWidth: 448,
          margin: '0 auto',
          zIndex: 60,
        }}
      >
        <Button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          variant="default"
          style={{ height: 44, width: '100%' }}
        >
          {mutation.isPending ? t('saving') : t('save')}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 드로어 래퍼
// ---------------------------------------------------------------------------

export function MeEditDrawer({ open, onOpenChange }: Props) {
  const t = useTranslations('me.edit');
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['me-profile'],
    queryFn: () =>
      apiFetch<{ ok: boolean; profile: ProfileData }>('/api/me', { token }).then((r) => r.profile),
    enabled: open,
    staleTime: 0,
  });

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 40 }} />
        <Drawer.Content
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            borderTopLeftRadius: 'var(--r-xl)',
            borderTopRightRadius: 'var(--r-xl)',
            backgroundColor: 'var(--bg-card)',
            maxHeight: '90vh',
          }}
        >
          <div
            style={{
              margin: '12px auto 0',
              height: 6,
              width: 48,
              borderRadius: 'var(--r-pill)',
              backgroundColor: 'var(--surface-2)',
            }}
          />
          <div style={{ padding: '16px 16px 8px' }}>
            <Drawer.Title
              style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}
            >
              {t('title')}
            </Drawer.Title>
            <Drawer.Description style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
              {t('description')}
            </Drawer.Description>
          </div>
          {error && (
            <p role="alert" style={{ padding: '0 16px', textAlign: 'center', fontSize: 14, color: 'var(--destructive)' }}>
              {error}
            </p>
          )}
          {profile ? (
            <MeEditForm
              key={profile.birth_date + profile.nickname}
              initial={profile}
              token={token}
              onSuccess={() => { setError(null); onOpenChange(false); }}
              onError={(msg) => setError(msg)}
            />
          ) : (
            <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)' }}>
              {t('saving')}
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

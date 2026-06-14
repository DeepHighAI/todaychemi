/**
 * draft-store.ts — 온보딩 임시 저장 Zustand 스토어 (웹앱 포트)
 *
 * 원본: src/lib/onboarding/draft-store.ts
 * 변경사항: next/* 없음, 동일 로직.
 * sessionStorage 사용 — WebView 탭 이동 시 상태 보존.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type TimeAccuracy = 'exact' | 'approximate' | 'unknown';
export type Gender = 'M' | 'F' | '';
export type Calendar = 'solar' | 'lunar';

interface OnboardingDraft {
  nickname: string;
  birthDate: string;
  calendar: Calendar;
  gender: Gender;
  knowledge: TimeAccuracy;
  birthTime: string;
  setNickname: (v: string) => void;
  setBirthDate: (v: string) => void;
  setCalendar: (v: Calendar) => void;
  setGender: (v: Gender) => void;
  setKnowledge: (v: TimeAccuracy) => void;
  setBirthTime: (v: string) => void;
  reset: () => void;
}

const INITIAL: Omit<
  OnboardingDraft,
  | 'setNickname'
  | 'setBirthDate'
  | 'setCalendar'
  | 'setGender'
  | 'setKnowledge'
  | 'setBirthTime'
  | 'reset'
> = {
  nickname: '',
  birthDate: '',
  calendar: 'solar',
  gender: '',
  knowledge: 'exact',
  birthTime: '',
};

export const useOnboardingDraft = create<OnboardingDraft>()(
  persist(
    (set) => ({
      ...INITIAL,
      setNickname: (v) => set({ nickname: v }),
      setBirthDate: (v) => set({ birthDate: v }),
      setCalendar: (v) => set({ calendar: v }),
      setGender: (v) => set({ gender: v }),
      setKnowledge: (v) => set({ knowledge: v }),
      setBirthTime: (v) => set({ birthTime: v }),
      reset: () => set(INITIAL),
    }),
    {
      name: 'onboarding-draft-v1',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);

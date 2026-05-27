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
  tos: boolean;
  setNickname: (v: string) => void;
  setBirthDate: (v: string) => void;
  setCalendar: (v: Calendar) => void;
  setGender: (v: Gender) => void;
  setKnowledge: (v: TimeAccuracy) => void;
  setBirthTime: (v: string) => void;
  setTos: (v: boolean) => void;
  reset: () => void;
}

const INITIAL: Omit<OnboardingDraft, 'setNickname' | 'setBirthDate' | 'setCalendar' | 'setGender' | 'setKnowledge' | 'setBirthTime' | 'setTos' | 'reset'> = {
  nickname: '',
  birthDate: '',
  calendar: 'solar',
  gender: '',
  knowledge: 'exact',
  birthTime: '',
  tos: false,
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
      setTos: (v) => set({ tos: v }),
      reset: () => set(INITIAL),
    }),
    {
      name: 'onboarding-draft-v1',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);

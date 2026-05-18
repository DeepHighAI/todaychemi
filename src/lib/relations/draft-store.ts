import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TimeAccuracy = 'exact' | 'approximate' | 'unknown';
export type Gender = 'M' | 'F' | '';
export type Calendar = 'solar' | 'lunar';
export type DraftMode = '' | '일합' | '친구합' | '돈합' | '첫합' | '썸합' | '오래합';

interface RelationDraft {
  nickname: string;
  gender: Gender;
  birthDate: string;
  calendar: Calendar;
  knowledge: TimeAccuracy;
  birthTime: string;
  mode: DraftMode;
  consent: boolean;
  setNickname: (v: string) => void;
  setGender: (v: Gender) => void;
  setBirthDate: (v: string) => void;
  setCalendar: (v: Calendar) => void;
  setKnowledge: (v: TimeAccuracy) => void;
  setBirthTime: (v: string) => void;
  setMode: (v: DraftMode) => void;
  setConsent: (v: boolean) => void;
  reset: () => void;
}

const INITIAL: Omit<RelationDraft, 'setNickname' | 'setGender' | 'setBirthDate' | 'setCalendar' | 'setKnowledge' | 'setBirthTime' | 'setMode' | 'setConsent' | 'reset'> = {
  nickname: '',
  gender: '',
  birthDate: '',
  calendar: 'solar',
  knowledge: 'exact',
  birthTime: '',
  mode: '',
  consent: false,
};

export const useRelationDraft = create<RelationDraft>()(
  persist(
    (set) => ({
      ...INITIAL,
      setNickname: (v) => set({ nickname: v }),
      setGender: (v) => set({ gender: v }),
      setBirthDate: (v) => set({ birthDate: v }),
      setCalendar: (v) => set({ calendar: v }),
      setKnowledge: (v) => set({ knowledge: v }),
      setBirthTime: (v) => set({ birthTime: v }),
      setMode: (v) => set({ mode: v }),
      setConsent: (v) => set({ consent: v }),
      reset: () => set(INITIAL),
    }),
    { name: 'relations-draft-v1' },
  ),
);

'use client';

import type { ChartCore } from '@/types/chart';
import type { DailyHapCard } from '@/types/dailyHap';
import type { OnboardingRequest } from '@/types/onboarding';

const GUEST_LEGAL_READY_KEY = 'osa_guest_legal_ready';
const GUEST_ONBOARDING_KEY = 'osa_guest_onboarding';
const GUEST_TODAY_KEY = 'osa_guest_today';

export interface GuestTodaySnapshot {
  onboarding: OnboardingRequest;
  card: DailyHapCard;
  chart: ChartCore;
  generatedAt: string;
}

function canUseSessionStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function loadJson<T>(key: string): T | null {
  if (!canUseSessionStorage()) return null;
  const raw = window.sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    window.sessionStorage.removeItem(key);
    return null;
  }
}

export function markGuestLegalConsentReady(): void {
  if (!canUseSessionStorage()) return;
  window.sessionStorage.setItem(GUEST_LEGAL_READY_KEY, '1');
}

export function hasGuestLegalConsentReady(): boolean {
  if (!canUseSessionStorage()) return false;
  return window.sessionStorage.getItem(GUEST_LEGAL_READY_KEY) === '1';
}

export function saveGuestOnboarding(input: OnboardingRequest): void {
  if (!canUseSessionStorage()) return;
  window.sessionStorage.setItem(GUEST_ONBOARDING_KEY, JSON.stringify(input));
}

export function loadGuestOnboarding(): OnboardingRequest | null {
  return loadJson<OnboardingRequest>(GUEST_ONBOARDING_KEY);
}

export function saveGuestToday(snapshot: GuestTodaySnapshot): void {
  if (!canUseSessionStorage()) return;
  window.sessionStorage.setItem(GUEST_TODAY_KEY, JSON.stringify(snapshot));
}

export function loadGuestToday(): GuestTodaySnapshot | null {
  return loadJson<GuestTodaySnapshot>(GUEST_TODAY_KEY);
}

export function clearGuestFlow(): void {
  if (!canUseSessionStorage()) return;
  window.sessionStorage.removeItem(GUEST_LEGAL_READY_KEY);
  window.sessionStorage.removeItem(GUEST_ONBOARDING_KEY);
  window.sessionStorage.removeItem(GUEST_TODAY_KEY);
}

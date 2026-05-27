import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  LEGAL_PRIVACY_VERSION,
  LEGAL_TERMS_VERSION,
  type LegalConsentFlow,
  type LegalConsentProvider,
  type LegalConsentSnapshot,
} from '@/lib/legal/consent';
import { getSupabaseServiceRoleKey } from '@/lib/supabase/env';
import type { Database } from '@/types/database.types';

export const LEGAL_CONSENT_COOKIE = 'osa_legal_consent';
export const LEGAL_CONSENT_TTL_SECONDS = 30 * 60;
export const LEGAL_GUEST_CONSENT_TTL_SECONDS = 24 * 60 * 60;
const SIGNED_GUEST_CONSENT_PREFIX = 'guest.v1.';

type ServiceClient = SupabaseClient<Database>;

interface CookieStore {
  get(name: string): { value: string } | undefined;
  set(
    name: string,
    value: string,
    options: {
      httpOnly?: boolean;
      sameSite?: 'lax' | 'strict' | 'none';
      secure?: boolean;
      path?: string;
      maxAge?: number;
      expires?: Date;
    },
  ): void;
}

interface LegalConsentRow {
  consent_id: string;
  auth_user_id: string | null;
  flow: LegalConsentFlow;
  provider: LegalConsentProvider | null;
  terms_version: string;
  privacy_version: string;
  age_confirmed: boolean;
  consented_at: string;
  expires_at: string;
  claimed_at: string | null;
}

export function hashLegalConsentToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function buildLegalConsentCookieOptions(maxAge = LEGAL_CONSENT_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}

export async function createLegalConsentRecord({
  serviceClient,
  flow,
  provider = null,
  now = new Date(),
  ttlSeconds = LEGAL_CONSENT_TTL_SECONDS,
}: {
  serviceClient: ServiceClient;
  flow: LegalConsentFlow;
  provider?: LegalConsentProvider | null;
  now?: Date;
  ttlSeconds?: number;
}): Promise<{ token: string; expiresAt: string; consent: LegalConsentSnapshot }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

  const { data, error } = await serviceClient
    .from('legal_consents')
    .insert({
      token_hash: hashLegalConsentToken(token),
      flow,
      provider,
      terms_version: LEGAL_TERMS_VERSION,
      privacy_version: LEGAL_PRIVACY_VERSION,
      age_confirmed: true,
      consented_at: now.toISOString(),
      expires_at: expiresAt,
    })
    .select(
      'consent_id,auth_user_id,flow,provider,terms_version,privacy_version,age_confirmed,consented_at,expires_at,claimed_at',
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'LEGAL_CONSENT_CREATE_FAILED');
  }

  return { token, expiresAt, consent: toLegalConsentSnapshot(data as LegalConsentRow) };
}

export async function createClaimedLegalConsentRecord({
  serviceClient,
  flow,
  provider = null,
  userId,
  now = new Date(),
  ttlSeconds = LEGAL_CONSENT_TTL_SECONDS,
}: {
  serviceClient: ServiceClient;
  flow: LegalConsentFlow;
  provider?: LegalConsentProvider | null;
  userId: string;
  now?: Date;
  ttlSeconds?: number;
}): Promise<LegalConsentSnapshot> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  const claimedAt = now.toISOString();

  const { data, error } = await serviceClient
    .from('legal_consents')
    .insert({
      auth_user_id: userId,
      token_hash: hashLegalConsentToken(token),
      flow,
      provider,
      terms_version: LEGAL_TERMS_VERSION,
      privacy_version: LEGAL_PRIVACY_VERSION,
      age_confirmed: true,
      consented_at: claimedAt,
      expires_at: expiresAt,
      claimed_at: claimedAt,
    })
    .select(
      'consent_id,auth_user_id,flow,provider,terms_version,privacy_version,age_confirmed,consented_at,expires_at,claimed_at',
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'LEGAL_CONSENT_CREATE_FAILED');
  }

  return toLegalConsentSnapshot(data as LegalConsentRow);
}

export function createSignedGuestLegalConsentToken({
  now = new Date(),
  ttlSeconds = LEGAL_GUEST_CONSENT_TTL_SECONDS,
}: {
  now?: Date;
  ttlSeconds?: number;
} = {}): { token: string; expiresAt: string; consent: LegalConsentSnapshot } {
  const consentedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  const consent: LegalConsentSnapshot = {
    termsVersion: LEGAL_TERMS_VERSION,
    privacyVersion: LEGAL_PRIVACY_VERSION,
    ageConfirmed: true,
    consentedAt,
  };
  const payload = Buffer.from(
    JSON.stringify({
      termsVersion: consent.termsVersion,
      privacyVersion: consent.privacyVersion,
      ageConfirmed: true,
      consentedAt,
      expiresAt,
    }),
    'utf8',
  ).toString('base64url');
  const signature = signGuestConsentPayload(payload);

  return {
    token: `${SIGNED_GUEST_CONSENT_PREFIX}${payload}.${signature}`,
    expiresAt,
    consent,
  };
}

export function setLegalConsentCookie(
  cookieStore: CookieStore,
  token: string,
  maxAge = LEGAL_CONSENT_TTL_SECONDS,
): void {
  cookieStore.set(LEGAL_CONSENT_COOKIE, token, buildLegalConsentCookieOptions(maxAge));
}

export function clearLegalConsentCookie(cookieStore: CookieStore): void {
  cookieStore.set(LEGAL_CONSENT_COOKIE, '', buildLegalConsentCookieOptions(0));
}

export async function claimLegalConsentFromCookie({
  serviceClient,
  cookieStore,
  userId,
  now = new Date(),
}: {
  serviceClient: ServiceClient;
  cookieStore: CookieStore;
  userId: string;
  now?: Date;
}): Promise<LegalConsentSnapshot | null> {
  const token = cookieStore.get(LEGAL_CONSENT_COOKIE)?.value;
  if (!token) return null;

  const row = await findConsentByToken(serviceClient, token, now);
  if (!row) return null;
  if (row.auth_user_id && row.auth_user_id !== userId) return null;

  const claimedAt = row.claimed_at ?? now.toISOString();
  const { data, error } = await serviceClient
    .from('legal_consents')
    .update({ auth_user_id: userId, claimed_at: claimedAt })
    .eq('consent_id', row.consent_id)
    .select(
      'consent_id,auth_user_id,flow,provider,terms_version,privacy_version,age_confirmed,consented_at,expires_at,claimed_at',
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'LEGAL_CONSENT_CLAIM_FAILED');
  }

  return toLegalConsentSnapshot(data as LegalConsentRow);
}

export async function getLatestLegalConsentForUser({
  serviceClient,
  userId,
  now = new Date(),
}: {
  serviceClient: ServiceClient;
  userId: string;
  now?: Date;
}): Promise<LegalConsentSnapshot | null> {
  const { data, error } = await serviceClient
    .from('legal_consents')
    .select(
      'consent_id,auth_user_id,flow,provider,terms_version,privacy_version,age_confirmed,consented_at,expires_at,claimed_at',
    )
    .eq('auth_user_id', userId)
    .eq('terms_version', LEGAL_TERMS_VERSION)
    .eq('privacy_version', LEGAL_PRIVACY_VERSION)
    .eq('age_confirmed', true)
    .gt('expires_at', now.toISOString())
    .order('consented_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? toLegalConsentSnapshot(data as LegalConsentRow) : null;
}

export async function resolveLegalConsentForOnboarding({
  serviceClient,
  cookieStore,
  userId,
  now = new Date(),
}: {
  serviceClient: ServiceClient;
  cookieStore: CookieStore;
  userId: string;
  now?: Date;
}): Promise<LegalConsentSnapshot | null> {
  const claimed = await claimLegalConsentFromCookie({ serviceClient, cookieStore, userId, now });
  if (claimed) return claimed;
  return getLatestLegalConsentForUser({ serviceClient, userId, now });
}

export async function resolveGuestLegalConsentFromCookie({
  serviceClient,
  cookieStore,
  now = new Date(),
}: {
  serviceClient: ServiceClient;
  cookieStore: CookieStore;
  now?: Date;
}): Promise<LegalConsentSnapshot | null> {
  const token = cookieStore.get(LEGAL_CONSENT_COOKIE)?.value;
  if (!token) return null;

  const signedGuestConsent = parseSignedGuestLegalConsentToken(token, now);
  if (signedGuestConsent) return signedGuestConsent;
  if (token.startsWith(SIGNED_GUEST_CONSENT_PREFIX)) return null;

  const row = await findConsentByToken(serviceClient, token, now);
  if (!row || row.flow !== 'guest') return null;
  return toLegalConsentSnapshot(row);
}

async function findConsentByToken(
  serviceClient: ServiceClient,
  token: string,
  now: Date,
): Promise<LegalConsentRow | null> {
  const { data, error } = await serviceClient
    .from('legal_consents')
    .select(
      'consent_id,auth_user_id,flow,provider,terms_version,privacy_version,age_confirmed,consented_at,expires_at,claimed_at',
    )
    .eq('token_hash', hashLegalConsentToken(token))
    .eq('terms_version', LEGAL_TERMS_VERSION)
    .eq('privacy_version', LEGAL_PRIVACY_VERSION)
    .eq('age_confirmed', true)
    .gt('expires_at', now.toISOString())
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? (data as LegalConsentRow) : null;
}

function toLegalConsentSnapshot(row: LegalConsentRow): LegalConsentSnapshot {
  return {
    termsVersion: row.terms_version,
    privacyVersion: row.privacy_version,
    ageConfirmed: true,
    consentedAt: row.consented_at,
  };
}

function parseSignedGuestLegalConsentToken(
  token: string,
  now: Date,
): LegalConsentSnapshot | null {
  if (!token.startsWith(SIGNED_GUEST_CONSENT_PREFIX)) return null;

  const rest = token.slice(SIGNED_GUEST_CONSENT_PREFIX.length);
  const [payload, signature] = rest.split('.');
  if (!payload || !signature || !isValidGuestConsentSignature(payload, signature)) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      termsVersion?: string;
      privacyVersion?: string;
      ageConfirmed?: boolean;
      consentedAt?: string;
      expiresAt?: string;
    };
    if (
      data.termsVersion !== LEGAL_TERMS_VERSION ||
      data.privacyVersion !== LEGAL_PRIVACY_VERSION ||
      data.ageConfirmed !== true ||
      !data.consentedAt ||
      !data.expiresAt ||
      !Number.isFinite(new Date(data.expiresAt).getTime()) ||
      new Date(data.expiresAt).getTime() <= now.getTime()
    ) {
      return null;
    }

    return {
      termsVersion: data.termsVersion,
      privacyVersion: data.privacyVersion,
      ageConfirmed: true,
      consentedAt: data.consentedAt,
    };
  } catch {
    return null;
  }
}

function signGuestConsentPayload(payload: string): string {
  return createHmac('sha256', getSupabaseServiceRoleKey()).update(payload).digest('base64url');
}

function isValidGuestConsentSignature(payload: string, signature: string): boolean {
  const expected = Buffer.from(signGuestConsentPayload(payload), 'base64url');
  const actual = Buffer.from(signature, 'base64url');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

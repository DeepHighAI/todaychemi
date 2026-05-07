'use client';

import { createClient } from '@/lib/supabase/client';

import { validatePassword, type PasswordPolicyError } from './password-policy';

export class WeakPasswordError extends Error {
  constructor(public readonly code: PasswordPolicyError) {
    super(`Password policy violation: ${code}`);
    this.name = 'WeakPasswordError';
  }
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUpWithEmail(email: string, password: string): Promise<void> {
  const result = validatePassword(password);
  if (!result.valid) throw new WeakPasswordError(result.code);
  const supabase = createClient();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
}

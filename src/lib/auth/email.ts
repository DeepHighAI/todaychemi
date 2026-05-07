'use client';

import { createClient } from '@/lib/supabase/client';

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

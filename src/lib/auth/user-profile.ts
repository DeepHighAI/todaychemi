import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.types';

type ServiceClient = SupabaseClient<Database>;

export async function hasPublicUserProfile(
  serviceClient: ServiceClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await serviceClient
    .from('users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

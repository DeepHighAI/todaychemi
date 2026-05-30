import { Suspense } from 'react';

import { LoadingState } from '@/components/feedback/LoadingState';
import { createClient } from '@/lib/supabase/server';

import ChargeClient from './charge-client';

export default async function PaymentsChargePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <Suspense
      fallback={(
        <main className="min-h-screen bg-background px-4 py-6">
          <LoadingState />
        </main>
      )}
    >
      <ChargeClient authenticated={Boolean(user)} />
    </Suspense>
  );
}

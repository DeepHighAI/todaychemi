import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import TodayPageClient from './today-page-client';

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/start');

  return <TodayPageClient />;
}

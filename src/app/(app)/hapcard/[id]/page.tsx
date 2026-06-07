import type { Metadata } from 'next';

import HapcardView from './HapcardView';

export async function generateMetadata(): Promise<Metadata> {
  // This route param is a relation id used to create/load today's hapcard.
  // The real hapcard id exists only after POST /api/hapcards; share OG lives on share URLs.
  return {};
}

export default function Page() {
  return <HapcardView />;
}

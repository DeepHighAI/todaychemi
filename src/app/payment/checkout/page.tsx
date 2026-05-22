import { Suspense } from 'react';

import { LoadingState } from '@/components/feedback/LoadingState';

import CheckoutClient from './checkout-client';

export default function PaymentCheckoutPage() {
  return (
    <Suspense
      fallback={(
        <main className="min-h-screen bg-background px-4 py-6">
          <LoadingState />
        </main>
      )}
    >
      <CheckoutClient />
    </Suspense>
  );
}

import { createHash } from 'crypto';

import { z } from 'zod';

import { getTossPaymentsSecretKey } from './env';

export const TossConfirmResponseSchema = z.object({
  paymentKey: z.string(),
  orderId: z.string(),
  status: z.string(),
  totalAmount: z.number(),
  approvedAt: z.string().nullable().optional(),
  receipt: z.object({ url: z.string().url().optional() }).nullable().optional(),
});

export type TossConfirmResponse = z.infer<typeof TossConfirmResponseSchema>;

export class TossPaymentError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'TossPaymentError';
  }
}

function tossAuthorizationHeader(): string {
  const secretKey = getTossPaymentsSecretKey();
  const authorization = Buffer.from(`${secretKey}:`, 'utf8').toString('base64');
  return `Basic ${authorization}`;
}

async function parseTossResponse(response: Response): Promise<TossConfirmResponse> {
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const errorBody = z
      .object({ code: z.string().optional(), message: z.string().optional() })
      .safeParse(json);
    throw new TossPaymentError(
      errorBody.success ? (errorBody.data.code ?? 'TOSS_REQUEST_FAILED') : 'TOSS_REQUEST_FAILED',
      errorBody.success ? (errorBody.data.message ?? 'Toss request failed') : 'Toss request failed',
      response.status,
    );
  }

  const parsed = TossConfirmResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new TossPaymentError('TOSS_RESPONSE_SHAPE_INVALID', parsed.error.message, 502);
  }

  return parsed.data;
}

export async function confirmTossPayment(input: {
  paymentKey: string;
  orderId: string;
  amount: number;
}): Promise<TossConfirmResponse> {
  const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: {
      Authorization: tossAuthorizationHeader(),
      'Content-Type': 'application/json',
      'Idempotency-Key': buildConfirmIdempotencyKey(input),
    },
    body: JSON.stringify(input),
  });

  return parseTossResponse(response);
}

function buildConfirmIdempotencyKey(input: {
  paymentKey: string;
  orderId: string;
}): string {
  const paymentKeyHash = createHash('sha256')
    .update(input.paymentKey, 'utf8')
    .digest('hex')
    .slice(0, 24);

  return `twoday_confirm_${input.orderId}_${paymentKeyHash}`;
}

export async function getTossPayment(paymentKey: string): Promise<TossConfirmResponse | null> {
  const response = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}`, {
    method: 'GET',
    headers: {
      Authorization: tossAuthorizationHeader(),
    },
  });

  if (response.status === 404) {
    return null;
  }

  return parseTossResponse(response);
}

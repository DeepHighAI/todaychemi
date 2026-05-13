import { NextResponse } from 'next/server';

export function apiErrorResponse(code: string, message = '', status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

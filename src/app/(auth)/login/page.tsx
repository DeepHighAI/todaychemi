'use client';

import { useState } from 'react';

import { signInWithKakao } from '@/lib/auth/kakao';

// S-00 에서 Google OAuth 로 교체 예정
export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleKakao() {
    try {
      setLoading(true);
      setError(null);
      await signInWithKakao();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'sign-in failed');
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow">
        <h1 className="mb-6 text-center text-xl font-semibold">합플 로그인</h1>
        <button
          type="button"
          onClick={handleKakao}
          disabled={loading}
          className="w-full rounded-lg bg-yellow-300 py-3 text-sm font-medium text-zinc-900 disabled:opacity-50"
        >
          {loading ? '연결 중...' : '카카오로 시작하기'}
        </button>
        {error && (
          <p className="mt-3 text-center text-sm text-red-600">{error}</p>
        )}
      </div>
    </main>
  );
}

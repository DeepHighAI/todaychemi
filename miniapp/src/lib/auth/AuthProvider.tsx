/**
 * AuthProvider.tsx
 *
 * Bearer 토큰 기반 인증 컨텍스트.
 * iOS WebView 에서 쿠키 대신 네이티브 Storage 에 토큰을 보관한다.
 *
 * P3 Auth Bridge (Option A) 구현 — appLogin() → /api/toss/login → Supabase 세션.
 *   흐름:
 *     1. `appLogin()` from '@apps-in-toss/web-framework' 호출
 *        → { authorizationCode, referrer } 반환
 *     2. POST VITE_API_BASE_URL/api/toss/login { authorizationCode, referrer }
 *        → 서버가 mTLS 토큰 교환 + Supabase 세션 민팅 후 { access_token, ... } 반환
 *     3. access_token 을 setToken() 으로 저장 → isAuthed=true
 *
 * 개발 오버라이드: VITE_DEV_BEARER 환경변수가 있으면 appLogin() 없이 즉시 인증됨.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { appLogin } from '@apps-in-toss/web-framework';
import { clearToken, getToken, setToken } from './toss-session';

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

interface AuthState {
  /** 현재 Bearer 토큰. null=미인증 */
  token: string | null;
  /** 토큰 존재 여부 */
  isAuthed: boolean;
  /** 초기 토큰 로드 완료 여부 */
  isLoading: boolean;
  /**
   * 토스 로그인 실행.
   * appLogin() → POST /api/toss/login → access_token 저장.
   * VITE_DEV_BEARER 가 설정된 경우 해당 토큰을 즉시 사용한다(개발 편의).
   */
  login: () => Promise<void>;
  /** 토큰 삭제 및 세션 초기화 */
  logout: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// 컨텍스트
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthState | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 앱 마운트 시 저장된 토큰을 복원한다
  useEffect(() => {
    getToken()
      .then((stored) => {
        setTokenState(stored);
      })
      .catch(() => {
        // 토큰 복원 실패 시 미인증 상태로 유지
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = useCallback(async () => {
    // 개발 환경 오버라이드: VITE_DEV_BEARER 가 있으면 appLogin() 없이 즉시 인증
    const devBearer = import.meta.env.VITE_DEV_BEARER as string | undefined;
    if (devBearer) {
      await setToken(devBearer);
      setTokenState(devBearer);
      return;
    }

    // 실제 Toss 로그인 흐름
    const { authorizationCode, referrer } = await appLogin();

    const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
    const res = await fetch(`${apiBase}/api/toss/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorizationCode, referrer }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: { code?: string } };
      throw new Error(
        body.error?.code ?? `로그인 서버 오류: ${res.status}`,
      );
    }

    const data = await res.json() as { access_token: string };
    await setToken(data.access_token);
    setTokenState(data.access_token);
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setTokenState(null);
  }, []);

  const value: AuthState = {
    token,
    isAuthed: token !== null,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** 인증 상태와 로그인/로그아웃 액션을 반환하는 훅 */
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth 는 <AuthProvider> 안에서 사용해야 합니다');
  }
  return ctx;
}

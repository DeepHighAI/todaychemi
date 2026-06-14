/**
 * AuthProvider.tsx
 *
 * Bearer 토큰 기반 인증 컨텍스트.
 * iOS WebView 에서 쿠키 대신 네이티브 Storage 에 토큰을 보관한다.
 *
 * TODO(P3): login() stub 을 실제 Toss appLogin() 흐름으로 교체.
 *   흐름:
 *     1. `appLogin()` from '@apps-in-toss/web-framework' 호출
 *        → { authorizationCode, referrer } 반환
 *     2. POST /api/toss/login { authorizationCode, referrer } 서버 전달
 *        → 서버가 mTLS 토큰 교환 후 앱 Bearer 세션 발급
 *     3. 응답의 token 을 setToken() 으로 저장 → isAuthed=true
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
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
   * 로그인 stub — P3 에서 appLogin() → POST /api/toss/login 흐름으로 교체.
   * 현재는 직접 토큰 문자열을 받아 저장한다(개발 편의 전용).
   */
  login: (token: string) => Promise<void>;
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

  const login = useCallback(async (newToken: string) => {
    await setToken(newToken);
    setTokenState(newToken);
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

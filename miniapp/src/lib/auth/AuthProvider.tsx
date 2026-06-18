/**
 * AuthProvider.tsx
 *
 * Bearer 토큰 기반 인증 컨텍스트.
 * iOS WebView 에서 쿠키 대신 네이티브 Storage 에 토큰을 보관한다.
 *
 * P3 Auth Bridge (Option A) — appLogin() → /api/toss/login → Supabase 세션.
 *   흐름:
 *     1. `appLogin()` from '@apps-in-toss/web-framework' → { authorizationCode, referrer }
 *     2. POST {VITE_API_BASE_URL}/api/toss/login → 서버 mTLS 토큰교환 + Supabase 세션 민팅
 *        → { access_token } 반환
 *     3. setToken() 저장 → isAuthed=true
 *
 * 자동 로그인: 네이티브 Toss 환경에서 저장 토큰이 없으면 마운트 시 login() 을 자동 호출한다
 *   (user_key 스코프 — PII·동의화면 없음, 앱인토스 seamless 진입). 실패 시 재시도 게이트 노출.
 *
 * 개발 오버라이드: dev(serve) 빌드에서만 VITE_DEV_BEARER 사용(프로덕션 .ait 미인라인, 보안).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { appLogin } from '@apps-in-toss/web-framework';
import { clearToken, getToken, isNativeTossEnv, setToken } from './toss-session';

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

interface AuthState {
  /** 현재 Bearer 토큰. null=미인증 */
  token: string | null;
  /** 토큰 존재 여부 */
  isAuthed: boolean;
  /** 초기 토큰 로드/자동 로그인 진행 여부 */
  isLoading: boolean;
  /**
   * 토스 로그인 실행.
   * appLogin() → POST /api/toss/login → access_token 저장.
   * dev(serve) 빌드에서 VITE_DEV_BEARER 가 있으면 해당 토큰을 즉시 사용한다.
   */
  login: () => Promise<void>;
  /** 토큰 삭제 및 세션 초기화 */
  logout: () => Promise<void>;
}

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
  // 자동 로그인 실패 상태 — 컨텍스트에 노출하지 않고 Provider 자체 재시도 게이트에만 사용.
  const [authError, setAuthError] = useState(false);

  const login = useCallback(async () => {
    setAuthError(false);
    // dev 오버라이드: dev(serve) 빌드 한정. 프로덕션(.ait)에서는 DEV=false → 미사용·미인라인.
    const devBearer = import.meta.env.DEV
      ? (import.meta.env.VITE_DEV_BEARER as string | undefined)
      : undefined;
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
      const body = (await res.json().catch(() => ({}))) as { error?: { code?: string } };
      throw new Error(body.error?.code ?? `로그인 서버 오류: ${res.status}`);
    }

    const data = (await res.json()) as { access_token: string };
    await setToken(data.access_token);
    setTokenState(data.access_token);
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setTokenState(null);
  }, []);

  // 마운트 부트스트랩: 저장 토큰 복원 → 없으면 네이티브 환경에서 자동 로그인.
  // StrictMode 이중 호출 방지를 위해 ref 가드.
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void (async () => {
      try {
        const stored = await getToken();
        if (stored) {
          setTokenState(stored);
          return;
        }
        // 네이티브 Toss 환경: appLogin 자동 트리거. 비-네이티브(웹 프리뷰)는 미발화.
        if (isNativeTossEnv()) {
          await login();
        }
      } catch {
        setAuthError(true);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [login]);

  const value: AuthState = {
    token,
    isAuthed: token !== null,
    isLoading,
    login,
    logout,
  };

  // 자동 로그인 실패(네이티브 + 토큰 없음) → 재시도 게이트.
  if (!isLoading && authError && token === null && isNativeTossEnv()) {
    return (
      <AuthRetryGate
        onRetry={() => {
          setIsLoading(true);
          login()
            .catch(() => setAuthError(true))
            .finally(() => setIsLoading(false));
        }}
      />
    );
  }

  // 초기 토큰 복원/자동 로그인이 끝나기 전에는 children 비렌더
  // (children 의 useQuery 들이 토큰 주입 전 발화해 401 retry 소진하는 경쟁 방지).
  return (
    <AuthContext.Provider value={value}>
      {isLoading ? null : children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// 자동 로그인 실패 재시도 게이트 (Provider 전용 — 컨텍스트 불필요)
// ---------------------------------------------------------------------------

function AuthRetryGate({ onRetry }: { onRetry: () => void }) {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '0 24px',
        backgroundColor: 'var(--background)',
        textAlign: 'center',
      }}
    >
      <p style={{ font: 'var(--t-h3)', color: 'var(--foreground)', margin: 0 }}>
        로그인에 실패했어요
      </p>
      <p style={{ font: 'var(--t-sub)', color: 'var(--muted-foreground)', margin: 0 }}>
        잠시 후 다시 시도해 주세요.
      </p>
      <button
        type="button"
        onClick={onRetry}
        style={{
          height: 48,
          padding: '0 24px',
          borderRadius: 'var(--r-pill)',
          border: 'none',
          fontWeight: 700,
          fontSize: 16,
          backgroundColor: 'var(--primary)',
          color: 'var(--primary-foreground)',
          cursor: 'pointer',
        }}
      >
        다시 시도
      </button>
    </main>
  );
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

import type { SharePayload } from '@/lib/share/build-share-payload';

const KAKAO_SDK_ID = 'kakao-js-sdk';
const KAKAO_SDK_SRC = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.1/kakao.min.js';

interface KakaoSharePayload extends SharePayload {
  share_id: string;
}

interface KakaoSdk {
  init: (key: string) => void;
  isInitialized: () => boolean;
  Share: {
    sendDefault: (options: {
      objectType: 'feed';
      content: {
        title: string;
        description: string;
        imageUrl: string;
        link: { mobileWebUrl: string; webUrl: string };
      };
      buttons: Array<{ title: string; link: { mobileWebUrl: string; webUrl: string } }>;
      serverCallbackArgs: { share_id: string };
    }) => void;
  };
}

declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

export async function shareToKakao(payload: KakaoSharePayload): Promise<void> {
  const kakao = await getInitializedKakaoSdk();
  kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title: payload.title,
      description: payload.text,
      imageUrl: payload.og_image_url ?? payload.url,
      link: {
        mobileWebUrl: payload.url,
        webUrl: payload.url,
      },
    },
    buttons: [
      {
        title: '오늘케미에서 보기',
        link: {
          mobileWebUrl: payload.url,
          webUrl: payload.url,
        },
      },
    ],
    serverCallbackArgs: {
      share_id: payload.share_id,
    },
  });
}

async function getInitializedKakaoSdk(): Promise<KakaoSdk> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Kakao SDK can only run in the browser');
  }

  await loadKakaoScript();
  const kakao = window.Kakao;
  const key = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;
  if (!kakao) throw new Error('Kakao SDK failed to load');
  if (!key) throw new Error('Missing NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY');
  if (!kakao.isInitialized()) {
    kakao.init(key);
  }
  return kakao;
}

function loadKakaoScript(): Promise<void> {
  const existing = document.getElementById(KAKAO_SDK_ID) as HTMLScriptElement | null;
  if (window.Kakao) return Promise.resolve();
  if (existing) return waitForScript(existing);

  const script = document.createElement('script');
  script.id = KAKAO_SDK_ID;
  script.src = KAKAO_SDK_SRC;
  script.crossOrigin = 'anonymous';
  document.head.appendChild(script);
  return waitForScript(script);
}

function waitForScript(script: HTMLScriptElement): Promise<void> {
  return new Promise((resolve, reject) => {
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('Kakao SDK load failed')), { once: true });
  });
}

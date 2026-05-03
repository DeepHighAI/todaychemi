# twa_bubblewrap.md — TWA (Trusted Web Activity) Android 패키징

> **도구**: Bubblewrap CLI
> **ADR 참조**: fortune_architecture.md §8.7 (TWA OAuth E2E PoC)

---

## 1. 사전 요구사항

```bash
# Bubblewrap CLI 설치
npm install -g @bubblewrap/cli

# Java JDK 8+ 필요
java -version

# Android SDK 필요 (환경 변수 설정)
export ANDROID_HOME=$HOME/Android/Sdk
```

---

## 2. twa-manifest.json 초기화

```bash
bubblewrap init --manifest https://<domain>/manifest.json
```

```json
// twa-manifest.json (생성됨)
{
  "packageId": "com.saju.lens",
  "host": "<domain>",
  "name": "합플 — 관계 사주",
  "launcherName": "합플",
  "display": "standalone",
  "themeColor": "#1A0A00",
  "navigationColor": "#1A0A00",
  "backgroundColor": "#FAF5F0",
  "enableNotifications": false,
  "startUrl": "/",
  "iconUrl": "https://<domain>/icon-512.png",
  "maskableIconUrl": "https://<domain>/icon-maskable-512.png",
  "shortcuts": [],
  "signingKey": {
    "path": "./android.keystore",
    "alias": "saju-lens"
  },
  "generatorApp": "bubblewrap-cli"
}
```

---

## 3. web/manifest.json 요구사항

```json
// public/manifest.json
{
  "name": "합플 — 관계 사주",
  "short_name": "합플",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FAF5F0",
  "theme_color": "#1A0A00",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    {
      "src": "/icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

---

## 4. Digital Asset Links (TWA 검증)

```json
// public/.well-known/assetlinks.json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.saju.lens",
    "sha256_cert_fingerprints": [
      "AA:BB:CC:DD:..."  // Play Console 앱 서명 인증서 SHA-256
    ]
  }
}]
```

**중요**: Next.js에서 `.well-known` 경로 제공 시 `next.config.ts`에 설정 필요:

```typescript
// next.config.ts
const nextConfig = {
  async headers() {
    return [
      {
        source: '/.well-known/assetlinks.json',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
      },
    ];
  },
};
```

---

## 5. 키스토어 서명 및 빌드

```bash
# 키스토어 생성 (최초 1회)
keytool -genkey -v -keystore android.keystore \
  -alias saju-lens -keyalg RSA -keysize 2048 -validity 10000

# AAB 빌드
bubblewrap build

# 산출물: app-release-bundle.aab
```

---

## 6. Supabase Auth Redirect URL 3종 등록

```
Supabase Dashboard → Authentication → URL Configuration
Site URL: https://<domain>
Redirect URLs:
  https://<domain>/auth/callback
  https://staging.<domain>/auth/callback
  http://localhost:3000/auth/callback
```

---

## 7. TWA OAuth E2E PoC 체크리스트 (G2 필수)

- [ ] `assetlinks.json` 생성 + 배포 확인
- [ ] Play Console SHA-256 등록
- [ ] Supabase Auth redirect URL 3종 등록
- [ ] Android 기기(또는 에뮬레이터)에 AAB 설치
- [ ] TWA 앱 오픈 → Google 로그인 → callback 복귀 → 세션 생성 확인
- [ ] 스크린샷 증빙 첨부

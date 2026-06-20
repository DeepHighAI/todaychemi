# Kakao Login (Removed) + KakaoTalk Share Runbook

## Kakao Login — Removed (2026-06-20, §1.1)

웹 카카오 **로그인**은 제거됐다. 사유: KOE205 — Supabase Kakao provider 기본 `account_email`
scope는 카카오 비즈니스(사업자) 인증 앱에만 허용되어 개인 개발자 앱에서 실패. 웹 OAuth는 Google 단독.

- Supabase Auth → Providers → **Kakao Disabled** 로 둔다.
- 추후 카카오 로그인을 다시 도입하려면: 카카오 비즈니스 앱 전환(사업자 인증) 후 동의항목(`account_email`)
  설정 + Redirect URI `https://jamhkucluhiibqpjsiov.supabase.co/auth/v1/callback` 등록 + Supabase Kakao
  provider 재활성. (이 경우 §1.1 재승인 + `parseProvider`/버튼 복원 필요.)

> 아래 **KakaoTalk Share** 는 로그인과 무관하게 계속 사용한다.

## KakaoTalk Share

1. Kakao JavaScript key를 `NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY`에 설정한다.
2. Kakao admin key를 서버 전용 `KAKAO_ADMIN_KEY`에 설정한다.
3. KakaoTalk Share callback URL을 설정한다.
   - Local tunnel: `https://<ngrok>/api/share/kakao/callback`
   - Production: `https://<vercel-production-url>/api/share/kakao/callback`
4. Callback Authorization은 `KakaoAK <KAKAO_ADMIN_KEY>` 형식이어야 한다.
5. Client share call은 `serverCallbackArgs.share_id`를 전달한다. 서버는 이 `share_id`로 `award_hapcard_share_reward` RPC를 호출한다.

Record only secret-free evidence in `docs/qa/external_settings_checklist.md`, for example:

```text
kakao_origin=production origin, callback=supabase auth callback, share_callback=/api/share/kakao/callback
```

## Privacy Checks

- Public share URL은 `/h/<random-token>` 형식이며 raw `hapcard_id`를 노출하지 않는다.
- DB에는 raw token을 저장하지 않고 `token_hash`만 저장한다.
- Share text, public page, OG image에는 `birth_date`, `name`, `email`, `birth_place`, raw `gender`를 넣지 않는다.
- Kakao profile/email/provider token은 auth 식별에만 사용하고 LLM/share payload에는 직렬화하지 않는다.

## Smoke Test

1. (카카오 로그인 제거 — Google 로그인 스모크는 `docs/runbooks/google_oauth.md` 참조.)
2. 케미카드 `공유` → 범위 선택 → `카카오톡`.
3. KakaoTalk share dialog opens and sends a card with `/h/<token>`.
4. Kakao callback receives `share_id` and returns `{ ok: true }`.
5. `/me` wallet ledger shows `보너스 +1`, same hapcard repeat does not add another bonus.

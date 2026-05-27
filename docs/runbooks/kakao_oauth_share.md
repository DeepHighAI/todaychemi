# Kakao OAuth + KakaoTalk Share Runbook

## Local / Supabase Auth

1. Kakao Developers에서 앱을 만들고 Kakao Login을 활성화한다.
2. Redirect URI에 Supabase callback URL을 등록한다.
   - Local: `http://127.0.0.1:54321/auth/v1/callback`
   - Remote: `https://jamhkucluhiibqpjsiov.supabase.co/auth/v1/callback`
3. Supabase Auth → Providers → Kakao를 활성화한다.
4. Kakao REST API key를 Supabase Kakao client id로, client secret을 secret으로 설정한다.
5. Kakao email은 필수 수집하지 않는다. Supabase provider의 email optional 설정을 켠다.

## KakaoTalk Share

1. Kakao JavaScript key를 `NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY`에 설정한다.
2. Kakao admin key를 서버 전용 `KAKAO_ADMIN_KEY`에 설정한다.
3. KakaoTalk Share callback URL을 설정한다.
   - Local tunnel: `https://<ngrok>/api/share/kakao/callback`
   - Production: `https://<app-domain>/api/share/kakao/callback`
4. Callback Authorization은 `KakaoAK <KAKAO_ADMIN_KEY>` 형식이어야 한다.
5. Client share call은 `serverCallbackArgs.share_id`를 전달한다. 서버는 이 `share_id`로 `award_hapcard_share_reward` RPC를 호출한다.

## Privacy Checks

- Public share URL은 `/h/<random-token>` 형식이며 raw `hapcard_id`를 노출하지 않는다.
- DB에는 raw token을 저장하지 않고 `token_hash`만 저장한다.
- Share text, public page, OG image에는 `birth_date`, `name`, `email`, `birth_place`, raw `gender`를 넣지 않는다.
- Kakao profile/email/provider token은 auth 식별에만 사용하고 LLM/share payload에는 직렬화하지 않는다.

## Smoke Test

1. `/login`에서 `카카오로 시작하기` 클릭 → Kakao OAuth → `/auth/callback` → `/`.
2. 합카드 `공유` → 범위 선택 → `카카오톡`.
3. KakaoTalk share dialog opens and sends a card with `/h/<token>`.
4. Kakao callback receives `share_id` and returns `{ ok: true }`.
5. `/me` wallet ledger shows `보너스 +1`, same hapcard repeat does not add another bonus.

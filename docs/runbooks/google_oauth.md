# Google OAuth Runbook

> Product names in this runbook follow the current UI copy: **오늘사이**, **오늘 우리는**, **오늘의 사이**, **그럴리 없어! 다시**, **또 다른 나**.

## Current App Flow

1. User opens **오늘사이 로그인** at `/login`.
2. User selects `Google로 시작하기`.
3. `src/lib/auth/google.ts` calls Supabase OAuth with `redirectTo = <origin>/auth/callback`.
4. `src/app/auth/callback/route.ts` exchanges the code and redirects to `/`.
5. Authenticated users land on 홈의 **오늘의 사이**.

## Supabase Remote Setup

Project ref: `jamhkucluhiibqpjsiov`.

Set these in Supabase Dashboard:

| Area | Value |
|---|---|
| Authentication > URL Configuration > Site URL | Production 오늘사이 URL |
| Authentication > URL Configuration > Redirect URLs | `https://<production-domain>/auth/callback` |
| Authentication > URL Configuration > Redirect URLs | `https://<staging-domain>/auth/callback` if staging exists |
| Authentication > URL Configuration > Redirect URLs | `http://localhost:3000/auth/callback` |
| Authentication > Providers > Google | Enabled |
| Authentication > Providers > Google > Client ID | Google Cloud OAuth Web Client ID |
| Authentication > Providers > Google > Client Secret | Google Cloud OAuth Web Client Secret |

Do not store the Client Secret in git, docs, test snapshots, or issue comments.

## Google Cloud Setup

Create or update a Web OAuth client:

| Area | Value |
|---|---|
| Authorized JavaScript origins | Production 오늘사이 origin |
| Authorized JavaScript origins | `http://localhost:3000` |
| Authorized redirect URIs | `https://jamhkucluhiibqpjsiov.supabase.co/auth/v1/callback` |
| Authorized redirect URIs | `http://127.0.0.1:54321/auth/v1/callback` for local Supabase |

## Local Config

`supabase/config.toml` keeps the local app callback allow-list:

```toml
site_url = "http://localhost:3000"
additional_redirect_urls = [
  "http://localhost:3000/auth/callback",
  "http://127.0.0.1:3000/auth/callback",
]
```

For local Supabase provider testing, set these only in `.env.local` or a local shell:

```bash
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=...
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=...
```

## Smoke Test

1. Start app with `pnpm dev`.
2. Open `/login`.
3. Select `Google로 시작하기`.
4. Confirm Google consent completes.
5. Confirm `/auth/callback` redirects to `/`.
6. Confirm 홈의 **오늘의 사이** renders and TabBar shows `홈`, `너랑나랑`, `내 사주맵`.

Failure triage:

| Symptom | Check |
|---|---|
| `provider_disabled` | Supabase Google provider enabled |
| `redirect_uri_mismatch` | Google Cloud redirect URI uses Supabase `/auth/v1/callback` |
| `/login?error=auth_callback_failed` | Supabase callback exchange logs |
| Redirect blocked | Supabase URL Configuration includes app `/auth/callback` |

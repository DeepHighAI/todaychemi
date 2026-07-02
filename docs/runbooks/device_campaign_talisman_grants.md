# 오늘케미 로컬 캠페인 부적 지급 런북

## 전제

- 지급 대상은 오늘케미 내부 `부적`이다. Toss Points 지급이 아니다.
- 기본 지급 경로는 미니앱 사용자가 복사한 운영 지원 ID(`userId`) 기준이다.
- deviceId 지급은 보조 경로다. 운영자는 토스에서 받은 raw `deviceId`를 입력하지만, 서버와 DB에는 HMAC 해시만 저장된다.
- deviceId 지급은 사용자가 최신 미니앱을 1회 열어 `/api/toss/device` 매핑이 생성되어 있어야 한다.
- 필수 환경변수:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- userId 지급만 사용할 때는 device hash secret이 필요 없다.
- deviceId 지급을 사용할 때만 `TOSS_DEVICE_ID_HASH_SECRET` 또는 기존 fallback `TOSS_USER_PASSWORD_SECRET`이 필요하다.
- 로컬 지급툴의 device hash secret은 `/api/toss/device`가 운영 DB 매핑을 만들 때 사용한 서버 secret과 같아야 한다. 새 값을 임의로 만들면 해시가 달라져 기존 매핑을 찾지 못한다.

## userId 확인

- 미니앱 사용자는 `내 프로필 > 서비스 정보 > 운영 지원 ID`를 눌러 본인의 `userId`를 복사한다.
- 운영자는 사용자가 전달한 운영 지원 ID를 로컬 지급툴의 `운영 지원 ID(userId)` 입력칸에 붙여넣는다.
- 운영 지원 ID는 보상 확인용 식별자이며, raw deviceId나 secret이 아니다.

## Dry Run

```bash
pnpm ops:grant-user-talisman -- --campaign launch_bonus_202607 --user-id "<운영 지원 ID>" --amount 10 --dry-run
```

`userId` 지급 `DRY_RUN`은 입력값만 확인하고 Supabase RPC를 호출하지 않는다. device hash secret도 필요 없다.

deviceId 보조 경로의 dry-run은 다음 명령을 사용한다.

```bash
pnpm ops:grant-device-talisman -- --campaign launch_bonus_202607 --device-id "<토스 deviceId>" --amount 10 --dry-run
```

deviceId `DRY_RUN`은 deviceId 형식과 해시 secret을 확인하고 Supabase에는 접근하지 않는다.

## 로컬 웹 운영툴

```bash
pnpm ops:grant-user-talisman:web
```

콘솔에 `http://127.0.0.1:8787/?token=...` 형태의 1회 실행 URL이 출력된다. 브라우저에서 해당 URL을 열고 지급 대상 `운영 지원 ID(userId)`, 캠페인 키, 지급 부적 수를 입력한다. 기본값은 드라이런이다.

기존 명령 `pnpm ops:grant-device-talisman:web`도 같은 웹툴을 실행한다. 웹툴 안에서 `토스 deviceId` 모드를 선택하면 보조 경로를 사용할 수 있다.

웹툴은 로컬 PC에서만 쓰도록 별도 스크립트로 실행된다.

- `127.0.0.1`에만 바인딩한다.
- `Host`, `Origin`, 접속 주소, 실행 토큰을 모두 확인한다.
- 브라우저 HTML/응답에 `SUPABASE_SERVICE_ROLE_KEY`, raw `deviceId`, 전체 device hash를 노출하지 않는다.
- 지급 또는 드라이런이 끝나면 대상 ID 입력칸을 비운다.

### 웹툴 설정 오류

- `CONFIG_MISSING_DEVICE_HASH_SECRET`: deviceId 모드에서 `.env.local`에 `TOSS_DEVICE_ID_HASH_SECRET` 또는 `TOSS_USER_PASSWORD_SECRET`이 없다. userId 모드로 지급하거나, 운영 DB와 같은 hash secret을 설정한다.
- `CONFIG_MISSING_SUPABASE_URL`: `NEXT_PUBLIC_SUPABASE_URL`을 설정한다.
- `CONFIG_MISSING_SUPABASE_SERVICE_ROLE_KEY`: `SUPABASE_SERVICE_ROLE_KEY`를 설정한다.
- 설정을 추가한 뒤에는 실행 중인 웹툴을 종료하고 `pnpm ops:grant-user-talisman:web`으로 다시 시작한다.

## 실제 지급

```bash
pnpm ops:grant-user-talisman -- --campaign launch_bonus_202607 --user-id "<운영 지원 ID>" --amount 10
```

성공 시 `reason: AWARDED`, `ledger_id`, `balance_after`가 출력된다.

deviceId 보조 경로의 실제 지급은 다음 명령을 사용한다.

```bash
pnpm ops:grant-device-talisman -- --campaign launch_bonus_202607 --device-id "<토스 deviceId>" --amount 10
```

deviceId 경로 출력에는 raw `deviceId`나 전체 hash가 포함되지 않는다.

## 결과 코드

- `AWARDED`: 지급 완료.
- `ALREADY_AWARDED`: 같은 캠페인에서 해당 사용자 또는 기기에 이미 지급됨.
- `USER_NOT_FOUND`: userId에 해당하는 오늘케미 프로필 사용자를 찾지 못함.
- `DEVICE_NOT_REGISTERED`: 해당 deviceId 해시 매핑이 없음. 사용자가 최신 미니앱을 1회 연 뒤 재시도한다.
- `AMBIGUOUS_DEVICE`: 같은 deviceId 해시가 여러 사용자에 연결되어 자동 지급 보류.
- `PROFILE_REQUIRED`: 토스 계정은 있으나 오늘케미 프로필이 없어 지갑 지급 대상이 아님.
- `INVALID_INPUT`: 캠페인 키, 해시, 지급량이 정책에 맞지 않음.

## 주의

- 캠페인 키는 `^[a-z0-9][a-z0-9_-]{0,63}$` 형식이어야 한다.
- userId 지급은 같은 캠페인에서 사용자 기준 1회만 지급된다.
- deviceId 지급은 같은 캠페인에서 사용자 기준 1회, 기기 기준 1회만 지급된다.
- 운영 로그, 이슈, 문서에 raw `deviceId`를 남기지 않는다.

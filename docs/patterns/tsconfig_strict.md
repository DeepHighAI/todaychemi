# tsconfig_strict.md — TypeScript Strict 설정

> **ADR 참조**: ADR-037 (기술 스택 잠금) — TypeScript strict mode 필수

---

## 1. 권장 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

## 2. 핵심 설정 설명

| 옵션 | 효과 |
|---|---|
| `strict: true` | strictNullChecks + strictFunctionTypes 등 7개 활성화 |
| `noUncheckedIndexedAccess` | `arr[0]`의 타입을 `T \| undefined`로 처리 (런타임 오류 방지) |
| `exactOptionalPropertyTypes` | optional 프로퍼티에 `undefined` 명시적 허용만 |

---

## 3. 주요 패턴

```typescript
// noUncheckedIndexedAccess 대응
const list = ['a', 'b', 'c'];
const first = list[0];  // string | undefined
if (first !== undefined) {
  console.log(first.toUpperCase());  // 안전
}

// exactOptionalPropertyTypes 대응
interface UserProfile {
  birth_time?: string;  // undefined 허용하려면 명시
}
// 잘못된 예: const profile: UserProfile = { birth_time: undefined };  // 에러
// 올바른 예: const profile: UserProfile = {};

// unknown + 타입 가드 (any 금지 규칙)
function parseResponse(raw: unknown): HapcardContent {
  if (!isHapcardContent(raw)) {
    throw new Error('Invalid hapcard response');
  }
  return raw;
}
```

---

## 4. 타입 체크 명령어

```bash
# Contracts-first 검증 (매 PR 전 필수)
pnpm tsc --noEmit

# 에러 카운트만 확인
pnpm tsc --noEmit 2>&1 | tail -5
```

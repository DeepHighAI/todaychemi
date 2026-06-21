import { describe, expect, it } from 'vitest';

import { assertNoDevBearerInBuild } from './assert-no-dev-bearer';

describe('assertNoDevBearerInBuild', () => {
  it('프로덕션 빌드(command=build)에 VITE_DEV_BEARER 가 있으면 throw 한다', () => {
    expect(() =>
      assertNoDevBearerInBuild({ command: 'build', devBearer: 'eyJhbGciOiJFUzI1NiJ9.payload.sig' }),
    ).toThrow(/VITE_DEV_BEARER/);
  });

  it('빌드인데 토큰이 빈 문자열이면 throw 하지 않는다', () => {
    expect(() => assertNoDevBearerInBuild({ command: 'build', devBearer: '' })).not.toThrow();
  });

  it('빌드인데 토큰이 undefined 면 throw 하지 않는다', () => {
    expect(() => assertNoDevBearerInBuild({ command: 'build', devBearer: undefined })).not.toThrow();
  });

  it('빌드인데 토큰이 공백뿐이면 throw 하지 않는다 (trim)', () => {
    expect(() => assertNoDevBearerInBuild({ command: 'build', devBearer: '   ' })).not.toThrow();
  });

  it('dev 서버(command=serve)에서는 토큰이 있어도 throw 하지 않는다', () => {
    expect(() =>
      assertNoDevBearerInBuild({ command: 'serve', devBearer: 'eyJhbGciOiJFUzI1NiJ9.payload.sig' }),
    ).not.toThrow();
  });
});

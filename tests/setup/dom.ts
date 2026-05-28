import '@testing-library/jest-dom/vitest';

// jsdom + vaul Drawer 호환성 패치
// jsdom 은 PointerEvent capture API 를 구현하지 않아, vaul onPointerDown
// 핸들러 내부의 setPointerCapture 호출이 TypeError 를 던진다.
// 테스트 assertion 은 모두 PASS 하지만 uncaught exception 으로
// exit code 가 0 이 아니어서 §1.2 검증 게이트를 막는다 → no-op mock 으로 우회.
if (typeof Element !== 'undefined') {
  if (typeof Element.prototype.setPointerCapture !== 'function') {
    Element.prototype.setPointerCapture = function setPointerCaptureNoop() {};
  }
  if (typeof Element.prototype.releasePointerCapture !== 'function') {
    Element.prototype.releasePointerCapture = function releasePointerCaptureNoop() {};
  }
  if (typeof Element.prototype.hasPointerCapture !== 'function') {
    Element.prototype.hasPointerCapture = function hasPointerCaptureNoop() {
      return false;
    };
  }
}

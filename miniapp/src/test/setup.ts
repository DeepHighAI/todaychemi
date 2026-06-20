// vitest 셋업 — @testing-library/jest-dom matcher 등록 (toBeInTheDocument 등).
import '@testing-library/jest-dom/vitest';

// jsdom 폴리필 — vaul/Radix 의 드래그 포인터 핸들러가 Pointer Capture API 를 호출하는데
// jsdom 은 미구현이라 시트 내부 클릭 시 throw 한다. 테스트 전용 no-op 스텁으로 막는다.
if (typeof Element !== 'undefined') {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  if (!proto.setPointerCapture) proto.setPointerCapture = () => {};
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => {};
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
  if (!proto.scrollIntoView) proto.scrollIntoView = () => {};
}

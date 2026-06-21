import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render';
import { Dialog, DialogContent } from './dialog';

/**
 * 포인터-이벤트 트랩 회귀 가드 (Phase 6).
 *
 * base-ui Dialog 의 Popup/Backdrop 는 pointer-events 를 명시하지 않아 body 의
 * computed pointer-events 를 상속한다. 케미카드 "..." 메뉴(vaul Drawer)가 닫히는
 * ~500ms 동안 vaul 은 body 를 pointer-events:none 으로 둔다. 그 창에서 별명 수정
 * Dialog/삭제 ConfirmDialog 가 열리면 none 을 상속해 실 포인터에 죽는다.
 * 단위테스트는 합성 클릭이라 이 회귀를 못 잡으므로(트랩 메모) 스타일을 직접 단언한다.
 */
describe('Dialog pointer-events 하드닝', () => {
  it('DialogContent(popup)는 pointerEvents:auto 를 명시한다', () => {
    renderWithProviders(
      <Dialog open>
        <DialogContent>hi</DialogContent>
      </Dialog>,
    );
    const popup = document.querySelector('[data-slot="dialog-content"]') as HTMLElement | null;
    expect(popup).not.toBeNull();
    expect(popup!.style.pointerEvents).toBe('auto');
  });

  it('DialogOverlay(backdrop)는 pointerEvents:auto 를 명시한다', () => {
    renderWithProviders(
      <Dialog open>
        <DialogContent>hi</DialogContent>
      </Dialog>,
    );
    const overlay = document.querySelector('[data-slot="dialog-overlay"]') as HTMLElement | null;
    expect(overlay).not.toBeNull();
    expect(overlay!.style.pointerEvents).toBe('auto');
  });
});

import { describe, expect, it } from 'vitest';

import koMessages from './ko.json';

function readPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
}

describe('ko UX writing guard', () => {
  it('핵심 미니앱 문구에 가이드에서 피해야 하는 표현을 남기지 않는다', () => {
    const text = JSON.stringify(koMessages);
    expect(text).not.toContain('다시 시도해주세요');
    expect(text).not.toContain('입력해주세요');
    expect(text).not.toContain('선택해주세요');
    expect(text).not.toContain('확인해주세요');
    expect(text).not.toContain('선택하세요');
    expect(text).not.toContain('하시겠습니까');
  });

  it('Dialog 왼쪽 액션은 닫기로 통일한다', () => {
    const dialogClosePaths = [
      'feed.delete.cancel',
      'hapcard.delete.cancel',
      'hapcard.rename.cancel',
      'hapcard.replayButton.cancel',
      'home.delete.cancel',
      'me.privacyControls.cancel',
      'relations.detail.memos.sheet.cancel',
    ];

    for (const path of dialogClosePaths) {
      expect(readPath(koMessages, path), path).toBe('닫기');
    }
  });

  it('진짜 취소 의미의 공통 키는 보존한다', () => {
    expect(koMessages.common.cancel).toBe('취소');
  });
});

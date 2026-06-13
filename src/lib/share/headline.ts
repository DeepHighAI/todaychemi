const HEADLINE_MAX = 40;
const CONCLUSION_PREFIX = /^결론\s*[=:]\s*/;

// 케미카드 본문(main_text)에서 공유용 한 줄 코멘트를 추출한다.
// "결론 =" 접두 제거 → 첫 줄 → 첫 문장 → 40자 상한. PII 아님(LLM 해석 요약).
export function extractShareHeadline(mainText: string): string {
  // 첫 비어있지 않은 줄을 사용한다 — LLM 이 \n 구분 본문 앞에 개행을 붙여도 내용을 잃지 않게.
  const firstLine = mainText.split('\n').map((line) => line.trim()).find((line) => line.length > 0) ?? '';
  if (firstLine.length === 0) return '';

  const withoutPrefix = firstLine.replace(CONCLUSION_PREFIX, '').trim();
  const firstSentence = withoutPrefix.split(/[.。!?]/)[0]?.trim() ?? withoutPrefix;
  const headline = firstSentence.length > 0 ? firstSentence : withoutPrefix;

  if (headline.length > HEADLINE_MAX) {
    return headline.slice(0, HEADLINE_MAX) + '…';
  }
  return headline;
}

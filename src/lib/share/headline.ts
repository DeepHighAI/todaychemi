const HEADLINE_MAX = 40;
const CONCLUSION_PREFIX = /^결론\s*[=:]\s*/;

// 케미카드 본문(main_text)에서 공유용 한 줄 코멘트를 추출한다.
// "결론 =" 접두 제거 → 첫 줄 → 첫 문장 → 40자 상한. PII 아님(LLM 해석 요약).
export function extractShareHeadline(mainText: string): string {
  const firstLine = mainText.split('\n')[0]?.trim() ?? '';
  if (firstLine.length === 0) return '';

  const withoutPrefix = firstLine.replace(CONCLUSION_PREFIX, '').trim();
  const firstSentence = withoutPrefix.split(/[.。!?]/)[0]?.trim() ?? withoutPrefix;
  const headline = firstSentence.length > 0 ? firstSentence : withoutPrefix;

  if (headline.length > HEADLINE_MAX) {
    return headline.slice(0, HEADLINE_MAX) + '…';
  }
  return headline;
}

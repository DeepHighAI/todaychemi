const SENTENCE_PATTERN = /^(.+?[.。!?])/;

export function extractConclusion(mainText: string): string {
  const match = mainText.match(SENTENCE_PATTERN);
  return match ? match[1] : mainText;
}

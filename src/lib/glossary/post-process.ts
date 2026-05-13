import {
  COMPOUND_READINGS, SIPSIN_READINGS, SHINSAL_READINGS,
  SINGLE_CHAR_READINGS, CHAPTER_READINGS,
} from './hanja-readings';

// 한글(漢字) 패턴에서 괄호 안 Hanja 제거 — 한글이 앞에 있을 때만
// e.g. "자오충(子午沖)" → "자오충", "생(生)" → "생"
// 단, "滴天髓(적천수)" 같은 역순(Hanja first)은 보존
export function stripHanjaInParens(text: string): string {
  // 한글 음절 뒤에 오는 (漢字...) 만 제거
  // CJK Unified Ideographs(U+4E00–U+9FFF)만 포함. Extension A(U+3400–U+4DBF) 등 희귀 자형은 범위 제외 (현행 RAG 코퍼스에 미존재).
  return text.replace(/([가-힣]+)\(([一-鿿·，。]+)\)/g, '$1');
}

// Standalone Hanja sequences → Korean reading (longest match first)
export function transliterateHanja(text: string): string {
  let result = text;
  // 복합어 우선 — 키 길이 내림차순 정렬 후 치환 (긴 키가 짧은 키보다 먼저 매치되도록)
  const sortedCompounds = Object.entries(COMPOUND_READINGS)
    .sort((a, b) => b[0].length - a[0].length);
  for (const [hanja, reading] of sortedCompounds) {
    result = result.split(hanja).join(reading);
  }
  // Sipsin multi-char
  for (const [hanja, reading] of Object.entries(SIPSIN_READINGS)) {
    result = result.split(hanja).join(reading);
  }
  // Shinsal multi-char — longest-first sort (COMPOUND_READINGS와 동일 패턴)
  const sortedShinsal = Object.entries(SHINSAL_READINGS)
    .sort((a, b) => b[0].length - a[0].length);
  for (const [hanja, reading] of sortedShinsal) {
    result = result.split(hanja).join(reading);
  }
  // Single chars last
  for (const [hanja, reading] of Object.entries(SINGLE_CHAR_READINGS)) {
    result = result.split(hanja).join(reading);
  }
  return result;
}

// Main export: strip parens then transliterate remaining Hanja
export function convertHanja(text: string | null | undefined): string {
  // null/undefined 방어: 빈 문자열 반환
  if (!text) return '';
  return transliterateHanja(stripHanjaInParens(text));
}

// Chapter name lookup with fallback
export function translateChapter(chapter: string): string {
  return CHAPTER_READINGS[chapter] ?? transliterateHanja(chapter);
}

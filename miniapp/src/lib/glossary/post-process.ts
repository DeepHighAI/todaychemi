/**
 * post-process.ts — 한자 변환 유틸 (웹앱과 동일, next/* 없음)
 *
 * 웹앱 원본: src/lib/glossary/post-process.ts (read-only reference)
 * ADR-038: UI display layer 에서 한자 제거 의무.
 */

import {
  COMPOUND_READINGS, SIPSIN_READINGS, SHINSAL_READINGS,
  SINGLE_CHAR_READINGS, CHAPTER_READINGS,
} from './hanja-readings';

// 한글(漢字) 패턴에서 괄호 안 Hanja 제거 — 한글이 앞에 있을 때만
export function stripHanjaInParens(text: string): string {
  return text.replace(/([가-힣]+)\(([一-鿿·，。]+)\)/g, '$1');
}

// Standalone Hanja sequences → Korean reading (longest match first)
export function transliterateHanja(text: string): string {
  let result = text;
  const sortedChapters = Object.entries(CHAPTER_READINGS)
    .sort((a, b) => b[0].length - a[0].length);
  for (const [hanja, reading] of sortedChapters) {
    result = result.split(hanja).join(reading);
  }
  const sortedCompounds = Object.entries(COMPOUND_READINGS)
    .sort((a, b) => b[0].length - a[0].length);
  for (const [hanja, reading] of sortedCompounds) {
    result = result.split(hanja).join(reading);
  }
  for (const [hanja, reading] of Object.entries(SIPSIN_READINGS)) {
    result = result.split(hanja).join(reading);
  }
  const sortedShinsal = Object.entries(SHINSAL_READINGS)
    .sort((a, b) => b[0].length - a[0].length);
  for (const [hanja, reading] of sortedShinsal) {
    result = result.split(hanja).join(reading);
  }
  for (const [hanja, reading] of Object.entries(SINGLE_CHAR_READINGS)) {
    result = result.split(hanja).join(reading);
  }
  return result;
}

// Main export: strip parens then transliterate remaining Hanja
export function convertHanja(text: string | null | undefined): string {
  if (!text) return '';
  return transliterateHanja(stripHanjaInParens(text));
}

// Chapter name lookup with fallback
export function translateChapter(chapter: string): string {
  return CHAPTER_READINGS[chapter] ?? transliterateHanja(chapter);
}

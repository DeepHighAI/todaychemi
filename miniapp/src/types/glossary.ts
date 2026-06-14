/**
 * glossary.ts — 용어 사전 타입 (웹앱과 동일)
 *
 * 웹앱 원본: src/types/glossary.ts (read-only reference)
 */

export interface GlossaryTerm {
  term: string;
  reading?: string;
  definition: string;
  /** 바텀시트용 확장 본문 */
  extended_definition?: string;
  /** 관련 용어 키 목록 */
  related_terms?: GlossaryKey[];
  classic_quote: {
    source: string;
    original: string;
  } | null;
  /** UI 소프트 표기 (합→끌림 / 형→긴장 / 충→부딪힘 / 해→소모) */
  display_label?: string;
}

export type GlossaryKey =
  | '일주' | '십신' | '합' | '형' | '충' | '해'
  | '자오충' | '축미충' | '인신충' | '묘유충' | '진술충' | '사해충'
  | '인오술' | '신자진' | '사유축' | '해묘미'
  | '삼합' | '반합';

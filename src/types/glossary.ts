export interface GlossaryTerm {
  term: string;
  reading?: string;
  definition: string;
  /** 바텀시트용 확장 본문 (definition보다 긴 상세 설명). */
  extended_definition?: string;
  /** 관련 용어 키 목록 (자기 자신은 제외). */
  related_terms?: GlossaryKey[];
  classic_quote: {
    source: string;
    original: string;
  } | null;
}

export type GlossaryKey = '일주' | '십신' | '합' | '형' | '충' | '해';

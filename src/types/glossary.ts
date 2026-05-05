export interface GlossaryTerm {
  term: string;
  reading?: string;
  definition: string;
  classic_quote: {
    source: string;
    original: string;
  } | null;
}

export type GlossaryKey = '일주' | '십신' | '합' | '형' | '충' | '해';

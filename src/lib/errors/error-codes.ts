export const ERROR_CODES = [
  'CALC_FAIL',
  'CALC_UNKNOWN_TIME',
  'LLM_TIMEOUT',
  'LLM_RATE_LIMIT',
  'LLM_BANNED_OUTPUT',
  'USER_QUOTA_EXCEEDED',
  'IP_RATE_LIMIT',
  'NETWORK_OFFLINE',
  'INSUFFICIENT_TOKENS',
  'GROUNDING_FAILED',
  'INTERNAL_ERROR',
  'HAPCARD_NOT_FOUND',
  'USER_CHART_NOT_FOUND',
  'REPLAY_DURING_OUTAGE',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export function isErrorCode(v: unknown): v is ErrorCode {
  return typeof v === 'string' && (ERROR_CODES as ReadonlyArray<string>).includes(v);
}

export const ERROR_COPY: Record<ErrorCode, string> = {
  CALC_FAIL: '사주 계산에 실패했어요. 생년월일시를 한 번 더 확인해주세요.',
  CALC_UNKNOWN_TIME:
    '정확한 시간이 없다면 시나리오 추정으로 볼 수 있어요. 신뢰 구간이 함께 표시됩니다.',
  LLM_TIMEOUT: 'AI가 많이 생각 중이에요. 잠시 후 다시 시도해주세요.',
  LLM_RATE_LIMIT: '지금 이용자가 많아요. 1~2분 뒤 다시 시도해주세요.',
  LLM_BANNED_OUTPUT: '답변 품질이 기준을 못 채웠어요. 다시 시도할게요.',
  USER_QUOTA_EXCEEDED: '오늘의 질문 한도를 다 쓰셨어요. 내일 자정에 초기화됩니다.',
  IP_RATE_LIMIT: '너무 자주 시도하고 있어요. 1분 후 다시 해주세요.',
  NETWORK_OFFLINE: '인터넷 연결이 끊어졌어요. 마지막 결과는 확인할 수 있어요.',
  INSUFFICIENT_TOKENS: '포인트가 부족해요. 충전 후 다시 시도해주세요.',
  GROUNDING_FAILED: '고전 문헌 검증에 실패했어요. 잠시 후 다시 시도해주세요.',
  INTERNAL_ERROR: '잠시 문제가 생겼어요. 다시 시도해주세요.',
  HAPCARD_NOT_FOUND: '합카드를 찾을 수 없어요.',
  USER_CHART_NOT_FOUND: '본명식이 없어요. 먼저 본명식을 등록해주세요.',
  REPLAY_DURING_OUTAGE: 'AI 서비스 점검 중이에요. 잠시 후 다시 시도해주세요.',
};

// 특정 에러 코드에 대한 CTA 링크 정의 (현재: INSUFFICIENT_TOKENS → 충전 페이지)
export const ERROR_CTA: Partial<Record<ErrorCode, { label: string; href: string }>> = {
  INSUFFICIENT_TOKENS: { label: '충전하러 가기', href: '/me' },
};

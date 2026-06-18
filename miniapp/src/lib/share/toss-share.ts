/**
 * toss-share.ts — Apps-in-Toss 네이티브 공유 래퍼
 *
 * 케미카드 공유: 토스 딥링크(intoss://{appName}/hapcard/{id}) 를 공유 링크로 변환한 뒤
 * OS 네이티브 공유 시트로 전달한다.
 *
 * SDK 시그니처 (공식 문서 §공유):
 *   getTossShareLink(url: string, ogImageUrl?: string): Promise<string>
 *   share(message: { message: string }): Promise<void>
 *
 * OG 미리보기 이미지: 공개 OG 토큰 라우트(`/api/og/share/[token]`, 인증 없음)가 존재한다.
 *   `POST /api/hapcards/{id}/share` 가 공유 토큰을 발급하고 그 공개 OG URL(og_image_url)을 반환한다.
 *   이 URL 을 getTossShareLink 2번째 인자로 넘기면 외부 메신저 크롤러가 미리보기를 가져올 수 있다.
 *   share 발급에 실패하더라도 공유 자체가 깨지지 않도록 딥링크만 공유하는 폴백을 둔다.
 *
 * ⚠️ intoss:// 스킴은 앱 정식 출시 후에만 동작한다. 출시 전 테스트는 콘솔 업로드 시
 *    발급되는 테스트 스킴(intoss-private://...?_deploymentId=) 으로 검증한다.
 *
 * 출처: 구현 레퍼런스 §5(공유/lifecycle), getTossShareLink/share 공식 문서.
 */

import { getTossShareLink, share } from '@apps-in-toss/web-framework';

import { apiFetch } from '@/lib/api/client';

/** 딥링크 영구 키 — granite.config.ts appName 과 동일해야 함 */
const APP_NAME = 'todaychemi';

interface ShareCreateResponse {
  og_image_url: string;
}

/**
 * 공개 공유 토큰을 발급하고 OG 이미지 URL 을 반환한다.
 * 최소 노출 범위(별명만) + web_share 채널로 발급. 실패 시 null(폴백 → 딥링크만 공유).
 */
async function fetchShareOgImageUrl(id: string, token: string | null): Promise<string | null> {
  try {
    const res = await apiFetch<ShareCreateResponse>(`/api/hapcards/${encodeURIComponent(id)}/share`, {
      method: 'POST',
      token,
      body: { range: 'nickname-only', channel: 'web_share' },
    });
    return res.og_image_url ?? null;
  } catch {
    return null;
  }
}

/**
 * 케미카드를 토스 네이티브 공유 시트로 공유한다.
 *
 * @param id - hapcard id (딥링크 경로 키)
 * @param token - Bearer 토큰 (공유 토큰 발급용). 없으면 OG 없이 딥링크만 공유.
 * @throws SDK 미지원 환경 또는 사용자 취소 시 (호출부에서 try/catch)
 */
export async function shareHapcard(id: string, token: string | null = null): Promise<void> {
  const deeplink = `intoss://${APP_NAME}/hapcard/${encodeURIComponent(id)}`;
  const ogImageUrl = await fetchShareOgImageUrl(id, token);
  const tossLink = ogImageUrl
    ? await getTossShareLink(deeplink, ogImageUrl)
    : await getTossShareLink(deeplink);
  await share({ message: tossLink });
}

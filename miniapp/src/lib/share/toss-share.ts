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
 * ⚠️ OG 미리보기 이미지(ogImageUrl)는 현재 미전달:
 *    웹 OG 엔드포인트(/api/og/hapcard/[id])가 인증 게이트(401, 크롤러 차단)라
 *    외부 메신저 크롤러가 이미지를 가져올 수 없다. 공개 OG 토큰 엔드포인트(별도 PR)
 *    도입 후 ogImageUrl 을 전달하도록 확장한다. 그 전까지는 딥링크만 공유한다.
 *
 * ⚠️ intoss:// 스킴은 앱 정식 출시 후에만 동작한다. 출시 전 테스트는 콘솔 업로드 시
 *    발급되는 테스트 스킴(intoss-private://...?_deploymentId=) 으로 검증한다.
 *
 * 출처: 구현 레퍼런스 §5(공유/lifecycle), getTossShareLink/share 공식 문서.
 */

import { getTossShareLink, share } from '@apps-in-toss/web-framework';

/** 딥링크 영구 키 — granite.config.ts appName 과 동일해야 함 */
const APP_NAME = 'todaychemi';

/**
 * 케미카드를 토스 네이티브 공유 시트로 공유한다.
 *
 * @param id - hapcard id (딥링크 경로 키)
 * @throws SDK 미지원 환경 또는 사용자 취소 시 (호출부에서 try/catch)
 */
export async function shareHapcard(id: string): Promise<void> {
  const deeplink = `intoss://${APP_NAME}/hapcard/${encodeURIComponent(id)}`;
  const tossLink = await getTossShareLink(deeplink);
  await share({ message: tossLink });
}

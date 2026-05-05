import type { SharePayload } from '@/lib/share/build-share-payload';

export type ShareResult = 'shared' | 'copied' | 'aborted';

export async function shareOrCopy(payload: SharePayload): Promise<ShareResult> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: payload.title, text: payload.text, url: payload.url });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'aborted';
      throw err;
    }
  }

  await navigator.clipboard.writeText(`${payload.text}\n${payload.url}`);
  return 'copied';
}

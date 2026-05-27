import type { SharePayload } from '@/lib/share/build-share-payload';

export type ShareResult = 'shared' | 'copied' | 'downloaded' | 'aborted';

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

export async function shareLink(payload: SharePayload): Promise<ShareResult> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    throw new Error('Web Share API unavailable');
  }

  try {
    await navigator.share({ title: payload.title, text: payload.text, url: payload.url });
    return 'shared';
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'aborted';
    throw err;
  }
}

export async function shareCardOrDownload(payload: SharePayload): Promise<ShareResult> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    const file = await buildShareImageFile(payload).catch(() => null);
    if (file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: payload.title,
          text: payload.text,
          url: payload.url,
          files: [file],
        });
        return 'shared';
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return 'aborted';
        throw err;
      }
    }

    return shareLink(payload);
  }

  await downloadShareImage(payload);
  return 'downloaded';
}

export async function copyShareLink(payload: SharePayload): Promise<ShareResult> {
  await navigator.clipboard.writeText(`${payload.text}\n${payload.url}`);
  return 'copied';
}

export async function downloadShareImage(payload: SharePayload): Promise<void> {
  if (!payload.og_image_url) {
    await copyShareLink(payload);
    return;
  }

  const link = document.createElement('a');
  link.href = payload.og_image_url;
  link.download = 'oneul-sai-card.png';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function buildShareImageFile(payload: SharePayload): Promise<File | null> {
  if (!payload.og_image_url) return null;

  const response = await fetch(payload.og_image_url);
  if (!response.ok) return null;
  const blob = await response.blob();
  return new File([blob], 'oneul-sai-card.png', { type: blob.type || 'image/png' });
}

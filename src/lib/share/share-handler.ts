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

  return writeClipboardText(`${payload.text}\n${payload.url}`);
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
  return writeClipboardText(`${payload.text}\n${payload.url}`);
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

async function writeClipboardText(text: string): Promise<ShareResult> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return 'aborted';
  }

  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch (err) {
    if (isClipboardPermissionError(err)) return 'aborted';
    throw err;
  }
}

function isClipboardPermissionError(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
}

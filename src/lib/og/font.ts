let notoSansKrRegularFontPromise: Promise<ArrayBuffer> | null = null;

export function loadNotoSansKrRegularFont(requestUrl: string | URL): Promise<ArrayBuffer> {
  if (!notoSansKrRegularFontPromise) {
    const fontUrl = new URL('/fonts/NotoSansKR-Regular.otf', requestUrl);
    notoSansKrRegularFontPromise = fetch(fontUrl)
      .then((res) => res.arrayBuffer())
      .catch((err) => {
        notoSansKrRegularFontPromise = null;
        throw err;
      });
  }

  return notoSansKrRegularFontPromise;
}

export function resetOgFontCacheForTests(): void {
  notoSansKrRegularFontPromise = null;
}

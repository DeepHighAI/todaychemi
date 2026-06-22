/**
 * close-view.ts — Apps in Toss closeView bridge wrapper.
 *
 * @apps-in-toss/web-framework@2.7.0 exposes graniteEvent but does not type-export
 * closeView from its root. The native bridge method is still `closeView`, so this
 * tiny wrapper keeps the call typed and mockable without adding a new dependency.
 */

interface NativeEmitter {
  on: (event: string, callback: (data: unknown) => void) => () => void;
}

interface NativeWebView {
  postMessage: (message: string) => void;
}

interface AppsInTossWindow extends Window {
  ReactNativeWebView?: NativeWebView;
  __GRANITE_NATIVE_EMITTER?: NativeEmitter;
}

function createEventId(): string {
  return Math.random().toString(36).slice(2, 15);
}

function deserializeError(value: unknown): Error {
  if (
    value &&
    typeof value === 'object' &&
    '__isError' in value &&
    (value as { __isError?: unknown }).__isError
  ) {
    const message = String((value as { message?: unknown }).message ?? 'closeView failed');
    return Object.assign(new Error(message), value);
  }
  return value instanceof Error ? value : new Error(String(value));
}

export function closeMiniappView(): Promise<void> {
  const nativeWindow = window as AppsInTossWindow;
  const webView = nativeWindow.ReactNativeWebView;
  const emitter = nativeWindow.__GRANITE_NATIVE_EMITTER;

  if (!webView || !emitter) {
    return Promise.reject(new Error('closeView bridge is not available'));
  }

  const eventId = createEventId();
  const removers: Array<() => void> = [];

  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      for (const remove of removers) {
        remove();
      }
    };

    removers.push(
      emitter.on(`closeView/resolve/${eventId}`, () => {
        cleanup();
        resolve();
      }),
    );
    removers.push(
      emitter.on(`closeView/reject/${eventId}`, (error) => {
        cleanup();
        reject(deserializeError(error));
      }),
    );

    webView.postMessage(JSON.stringify({
      type: 'method',
      functionName: 'closeView',
      eventId,
      args: [],
    }));
  });
}

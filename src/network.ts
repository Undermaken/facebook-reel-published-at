import {
  extractRecords,
  FACEBOOK_ORIGIN,
  getReelId,
  JsonFrames,
  object,
  type ReelRecord,
} from './data';
import { RecordStore } from './bridge';

const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

function isGraphql(url: string): boolean {
  try {
    const parsed = new URL(url, FACEBOOK_ORIGIN);
    return (
      parsed.origin === FACEBOOK_ORIGIN && /^\/api\/graphql\/?$/.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

export function observeNetwork(emit: (records: ReelRecord[]) => void): () => void {
  let active = true;
  const readers = new Set<() => void>();
  const requests = new Map<XMLHttpRequest, () => void>();
  const requestUrls = new WeakMap<XMLHttpRequest, string>();
  const originalFetch = window.fetch;
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const allowed = () => active && getReelId(location.href) !== null;
  const collection = () => ({
    records: new RecordStore(),
    pending: false,
    failed: false,
  });
  const consume = (frames: unknown[], state: ReturnType<typeof collection>) => {
    if (!allowed()) return;
    for (const frame of frames) {
      const envelope = object(frame);
      const final = object(envelope?.extensions)?.is_final;
      if (envelope?.hasNext === true || final === false) state.pending = true;
      else if (envelope?.hasNext === false || final === true) state.pending = false;
      if (Array.isArray(envelope?.errors) && envelope.errors.length) state.failed = true;
      const records = extractRecords(frame, true);
      state.records.add(records);
      const immediate = records.flatMap((record) => {
        if (!record.dateUnavailable) return [record];
        return record.aiGenerated === undefined
          ? []
          : [{ videoId: record.videoId, aiGenerated: record.aiGenerated }];
      });
      if (immediate.length) emit(immediate);
    }
  };
  const finish = (state: ReturnType<typeof collection>) => {
    if (!allowed() || state.pending || state.failed) return;
    const records = state.records.recent();
    if (records.length) emit(records);
  };

  async function readResponse(response: Response): Promise<void> {
    if (!allowed() || readers.size >= 4 || !response.ok || !response.body) return;
    if (response.url && !isGraphql(response.url)) return;
    const length = Number(response.headers.get('content-length'));
    if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES) return;
    const reader = response.clone().body?.getReader();
    if (!reader) return;
    let cancelled = false;
    const cancel = () => {
      cancelled = true;
      void reader.cancel().catch(() => {});
    };
    readers.add(cancel);
    const timeout = window.setTimeout(cancel, 15_000);
    const decoder = new TextDecoder();
    const parser = new JsonFrames();
    const metadata = collection();
    let bytes = 0;
    let completed = false;
    try {
      while (allowed()) {
        const part = await reader.read();
        if (part.done) {
          completed = true;
          break;
        }
        bytes += part.value.byteLength;
        if (bytes > MAX_RESPONSE_BYTES) {
          cancel();
          break;
        }
        consume(parser.push(decoder.decode(part.value, { stream: true })), metadata);
      }
      if (allowed() && completed && !cancelled) {
        consume(parser.push(decoder.decode()), metadata);
        if (parser.isComplete()) finish(metadata);
      }
    } finally {
      window.clearTimeout(timeout);
      readers.delete(cancel);
      reader.releaseLock();
    }
  }

  const wrappedFetch: typeof fetch = function (this: Window, ...args) {
    const result = Reflect.apply(originalFetch, this, args) as Promise<Response>;
    try {
      const input: unknown = args[0];
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input instanceof Request
              ? input.url
              : '';
      if (allowed() && isGraphql(url)) {
        void result.then((response) => readResponse(response)).catch(() => {});
      }
    } catch {
      /* Inspection must not change native fetch semantics. */
    }
    return result;
  };

  const wrappedOpen: typeof XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest,
    ...args: [
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null,
    ]
  ) {
    requests.get(this)?.();
    Reflect.apply(originalOpen, this, args);
    requestUrls.delete(this);
    try {
      const url =
        typeof args[1] === 'string'
          ? args[1]
          : args[1] instanceof URL
            ? args[1].href
            : '';
      if (allowed() && isGraphql(url)) requestUrls.set(this, url);
    } catch {
      /* Keep URL inspection separate from native open(). */
    }
  };

  function observeXhr(xhr: XMLHttpRequest): () => void {
    const parser = new JsonFrames();
    const metadata = collection();
    let offset = 0;
    let jsonRead = false;
    let finished = false;
    const cleanup = () => {
      window.clearTimeout(timeout);
      xhr.removeEventListener('progress', read);
      xhr.removeEventListener('load', read);
      xhr.removeEventListener('loadend', cleanup);
      requests.delete(xhr);
    };
    const read = () => {
      if (!allowed()) {
        cleanup();
        return;
      }
      if (xhr.responseURL && !isGraphql(xhr.responseURL)) return;
      try {
        if (xhr.responseType === 'json') {
          if (xhr.readyState === XMLHttpRequest.DONE && !jsonRead) {
            jsonRead = true;
            consume([xhr.response], metadata);
          }
        } else if (xhr.responseType === '' || xhr.responseType === 'text') {
          const text = xhr.responseText;
          if (text.length > MAX_RESPONSE_BYTES) {
            cleanup();
            return;
          }
          const chunk = text.slice(offset);
          offset = text.length;
          consume(parser.push(chunk), metadata);
        }
        if (
          !finished &&
          xhr.readyState === XMLHttpRequest.DONE &&
          xhr.status >= 200 &&
          xhr.status < 300
        ) {
          finished = true;
          if (xhr.responseType === 'json' || parser.isComplete()) finish(metadata);
        }
      } catch {
        /* Observing a response must never interrupt Facebook. */
      }
    };
    const timeout = window.setTimeout(cleanup, 15_000);
    requests.set(xhr, cleanup);
    xhr.addEventListener('progress', read);
    xhr.addEventListener('load', read);
    xhr.addEventListener('loadend', cleanup);
    return cleanup;
  }

  const wrappedSend: XMLHttpRequest['send'] = function (this: XMLHttpRequest, ...args) {
    let cleanup: (() => void) | undefined;
    try {
      if (
        allowed() &&
        requestUrls.has(this) &&
        !requests.has(this) &&
        requests.size < 16
      ) {
        cleanup = observeXhr(this);
      }
    } catch {
      /* Do not prevent a request if observation fails. */
    }
    try {
      return Reflect.apply(originalSend, this, args);
    } catch (error) {
      cleanup?.();
      throw error;
    }
  };

  window.fetch = wrappedFetch;
  XMLHttpRequest.prototype.open = wrappedOpen;
  XMLHttpRequest.prototype.send = wrappedSend;
  return () => {
    active = false;
    for (const cancel of readers) cancel();
    readers.clear();
    for (const cleanup of requests.values()) cleanup();
    requests.clear();
    if (window.fetch === wrappedFetch) window.fetch = originalFetch;
    if (XMLHttpRequest.prototype.open === wrappedOpen)
      XMLHttpRequest.prototype.open = originalOpen;
    if (XMLHttpRequest.prototype.send === wrappedSend)
      XMLHttpRequest.prototype.send = originalSend;
  };
}

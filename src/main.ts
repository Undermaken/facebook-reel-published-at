import { bridgeMessage, post, RecordStore } from './bridge';
import { getReelId } from './data';
import { observeNetwork } from './network';

const marker = Symbol.for('facebook-reel-date/main/v1');
const state = window as unknown as Record<symbol, boolean>;

if (!state[marker]) {
  state[marker] = true;
  const cache = new RecordStore();
  let previousId: string | null = null;
  let stopNetwork: (() => void) | undefined;
  let suspended = false;
  let lastReady = 0;
  let enabled = false;

  function syncRoute() {
    const id = suspended ? null : getReelId(location.href);
    if (!id) cache.clear();
    if (id && enabled && !stopNetwork) {
      stopNetwork = observeNetwork((records) => {
        cache.add(records);
        post('records', records);
      });
    } else if ((!id || !enabled) && stopNetwork) {
      stopNetwork();
      stopNetwork = undefined;
    }
    if (id !== previousId) {
      previousId = id;
      post('navigation');
    }
  }

  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method];
    history[method] = function (
      this: History,
      ...args: Parameters<History['pushState']>
    ) {
      const result = Reflect.apply(original, this, args);
      syncRoute();
      return result;
    };
  }

  window.addEventListener('popstate', syncRoute);
  window.addEventListener('message', (event) => {
    const message = bridgeMessage(event);
    if (message?.type !== 'ready' || typeof message.enabled !== 'boolean') return;
    enabled = message.enabled;
    syncRoute();
    if (
      !enabled ||
      !getReelId(location.href) ||
      suspended ||
      Date.now() - lastReady < 250
    )
      return;
    lastReady = Date.now();
    post('records', cache.recent());
  });
  window.addEventListener('pagehide', () => {
    suspended = true;
    syncRoute();
  });
  window.addEventListener('pageshow', () => {
    suspended = false;
    syncRoute();
  });
  syncRoute();
}

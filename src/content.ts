import { bridgeMessage, post, readRecords, RecordStore } from './bridge';
import { extractRecords, getReelId, MAX_FRAME_CHARS } from './data';
import { DateView } from './view';
import { DEFAULT_SETTINGS, subscribeSettings } from './settings';

const marker = Symbol.for('facebook-reel-date/content/v1');
const state = window as unknown as Record<symbol, boolean>;

if (!state[marker]) {
  state[marker] = true;
  const cache = new RecordStore();
  const view = new DateView();
  let activeId: string | null = null;
  let timer: number | undefined;
  let poll: number | undefined;
  let suspended = false;
  let seenScripts = new WeakSet<HTMLScriptElement>();
  let settings = { ...DEFAULT_SETTINGS };
  let stopSettings: (() => void) | undefined;
  let settingsReady = false;

  function announce() {
    post('ready', [], settingsReady && settings.showDate && !suspended);
  }

  function startSettings() {
    if (stopSettings) return;
    settingsReady = false;
    stopSettings = subscribeSettings((value) => {
      settings = value;
      settingsReady = true;
      announce();
      syncRoute();
    });
  }

  function scanJson() {
    for (const script of [
      ...document.querySelectorAll<HTMLScriptElement>('script[type="application/json"]'),
    ].slice(0, 512)) {
      if (seenScripts.has(script)) continue;
      const text = script.textContent;
      if (!text) continue;
      if (
        text.length > MAX_FRAME_CHARS ||
        (!text.includes('publish_time') && !text.includes('ai_generated_detected_info'))
      ) {
        seenScripts.add(script);
        continue;
      }
      try {
        cache.add(extractRecords(JSON.parse(text)));
        seenScripts.add(script);
      } catch {
        /* A streamed script may not be complete yet. */
      }
    }
  }

  function refresh() {
    if (activeId && getReelId(location.href) === activeId)
      view.render(cache.get(activeId), settings);
    else view.clear();
  }

  function schedule() {
    if (!activeId || timer !== undefined) return;
    timer = window.setTimeout(() => {
      timer = undefined;
      if (!activeId || getReelId(location.href) !== activeId) return;
      scanJson();
      refresh();
    }, 80);
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const element =
        mutation.target instanceof Element
          ? mutation.target
          : mutation.target.parentElement;
      const script = element?.closest('script');
      if (script instanceof HTMLScriptElement) seenScripts.delete(script);
    }
    schedule();
  });
  function syncRoute() {
    const routeId = suspended ? null : getReelId(location.href);
    if (!routeId) cache.clear();
    const id = suspended || !settingsReady || !settings.showDate ? null : routeId;
    if (id === activeId) {
      refresh();
      return;
    }
    const wasActive = activeId !== null;
    activeId = id;
    view.clear();
    window.clearTimeout(timer);
    timer = undefined;
    // Also synchronize MAIN when polling detects an exit that bypassed its hooks.
    announce();
    if (!id) {
      observer.disconnect();
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      seenScripts = new WeakSet();
      return;
    }
    if (!wasActive) {
      observer.observe(document, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['href', 'src', 'poster', 'hidden', 'aria-hidden', 'role'],
      });
      window.addEventListener('scroll', schedule, { capture: true, passive: true });
      window.addEventListener('resize', schedule, { passive: true });
    }
    schedule();
  }

  window.addEventListener('message', (event) => {
    const message = bridgeMessage(event);
    if (!message) return;
    if (message.type === 'navigation') {
      syncRoute();
      return;
    }
    if (
      message.type !== 'records' ||
      suspended ||
      !settingsReady ||
      !settings.showDate ||
      !getReelId(location.href)
    )
      return;
    syncRoute();
    cache.add(readRecords(message.records));
    schedule();
  });
  window.addEventListener('popstate', syncRoute);
  window.addEventListener('pagehide', () => {
    suspended = true;
    stopSettings?.();
    stopSettings = undefined;
    settingsReady = false;
    announce();
    window.clearInterval(poll);
    poll = undefined;
    syncRoute();
  });
  window.addEventListener('pageshow', () => {
    suspended = false;
    startSettings();
    if (poll === undefined) poll = window.setInterval(syncRoute, 500);
    syncRoute();
  });
  poll = window.setInterval(syncRoute, 500);
  startSettings();
  syncRoute();
}

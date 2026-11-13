import { bridgeMessage, post, RecordStore } from './bridge';
import { extractRecords, getReelId, MAX_FRAME_CHARS } from './data';
import { DateView } from './view';
import { DEFAULT_SETTINGS, subscribeSettings } from './settings';
import { MissingBadgeDiagnostics } from './diagnostics';

const controllerKey = Symbol.for('facebook-reel-date/content/v1');
const takeoverEvent = 'facebook-reel-date/controller-start';

class ReelDateController {
  private readonly instanceId = crypto.randomUUID();
  private readonly cache = new RecordStore();
  private readonly view = new DateView();
  private readonly diagnostics = new MissingBadgeDiagnostics();
  private readonly observer: MutationObserver;
  private activeId: string | null = null;
  private refreshTimer: number | undefined;
  private routePoll: number | undefined;
  private suspended = false;
  private disposed = false;
  private seenScripts = new WeakSet<HTMLScriptElement>();
  private settings = { ...DEFAULT_SETTINGS };
  private stopSettings: (() => void) | undefined;
  private settingsReady = false;

  static start(): void {
    const page = window as Window & { [controllerKey]?: ReelDateController };
    const previous = page[controllerKey] as unknown as
      { dispose?: () => void; suspend?: () => void } | undefined;
    if (previous) {
      try {
        if (previous.dispose) previous.dispose();
        else previous.suspend?.();
      } catch {
        // A controller from an invalidated extension may reject API cleanup.
      }
    }
    page[controllerKey] = new ReelDateController();
  }

  private constructor() {
    this.observer = new MutationObserver(this.onMutations);
    document.addEventListener(takeoverEvent, this.onTakeover);
    window.addEventListener('message', this.onMessage);
    window.addEventListener('popstate', this.syncRoute);
    window.addEventListener('pagehide', this.suspend);
    window.addEventListener('pageshow', this.resume);
    chrome.runtime.onMessage.addListener(this.onExtensionMessage);
    document.dispatchEvent(new CustomEvent(takeoverEvent, { detail: this.instanceId }));
    this.resume();
  }

  private onTakeover = (event: Event): void => {
    if ((event as CustomEvent<string>).detail !== this.instanceId) this.dispose();
  };

  private onExtensionMessage = (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: string) => void,
  ): void => {
    if (message === 'facebook-reel-date/ping' && sender.id === chrome.runtime.id)
      sendResponse('ready');
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.suspended = true;
    window.clearInterval(this.routePoll);
    window.clearTimeout(this.refreshTimer);
    this.observer.disconnect();
    this.view.clear();
    this.diagnostics.update(null, 'inactive');
    window.removeEventListener('scroll', this.scheduleRefresh, true);
    window.removeEventListener('resize', this.scheduleRefresh);
    document.removeEventListener(takeoverEvent, this.onTakeover);
    window.removeEventListener('message', this.onMessage);
    window.removeEventListener('popstate', this.syncRoute);
    window.removeEventListener('pagehide', this.suspend);
    window.removeEventListener('pageshow', this.resume);
    try {
      this.stopSettings?.();
    } catch {
      // The old extension context may already be invalidated.
    }
    this.stopSettings = undefined;
    try {
      chrome.runtime.onMessage.removeListener(this.onExtensionMessage);
    } catch {
      // The old extension context may already be invalidated.
    }
  }

  private announce(): void {
    post('ready', [], this.settingsReady && this.settings.showDate && !this.suspended);
  }

  private startSettings(): void {
    if (this.stopSettings) return;
    this.settingsReady = false;
    this.stopSettings = subscribeSettings((value) => {
      this.settings = value;
      this.settingsReady = true;
      this.announce();
      const activeId = this.activeId;
      this.syncRoute();
      if (this.activeId && this.activeId === activeId) this.refresh();
    });
  }

  private scanJson(): void {
    const scripts = document.querySelectorAll<HTMLScriptElement>(
      'script[type="application/json"]',
    );
    for (const script of [...scripts].slice(0, 512)) {
      if (this.seenScripts.has(script)) continue;
      const text = script.textContent;
      if (!text) continue;
      if (
        text.length > MAX_FRAME_CHARS ||
        (!text.includes('publish_time') && !text.includes('ai_generated_detected_info'))
      ) {
        this.seenScripts.add(script);
        continue;
      }
      try {
        this.cache.add(extractRecords(JSON.parse(text)));
        this.seenScripts.add(script);
      } catch {
        /* A streamed script may not be complete yet. */
      }
    }
  }

  private refresh(): void {
    if (this.activeId && getReelId(location.href) === this.activeId) {
      try {
        const status = this.view.render(this.cache.get(this.activeId), this.settings);
        this.diagnostics.update(this.activeId, status);
      } catch {
        this.view.clear();
        this.diagnostics.update(this.activeId, 'render_failed');
      }
    } else {
      this.view.clear();
      this.diagnostics.update(null, 'inactive');
    }
  }

  private scheduleRefresh = (): void => {
    if (this.disposed || !this.activeId || this.refreshTimer !== undefined) return;
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = undefined;
      if (!this.activeId || getReelId(location.href) !== this.activeId) return;
      this.scanJson();
      this.refresh();
    }, 80);
  };

  private onMutations = (mutations: MutationRecord[]): void => {
    for (const mutation of mutations) {
      const element =
        mutation.target instanceof Element
          ? mutation.target
          : mutation.target.parentElement;
      const script = element?.closest('script');
      if (script instanceof HTMLScriptElement) this.seenScripts.delete(script);
    }
    this.scheduleRefresh();
  };

  private syncRoute = (): void => {
    if (this.disposed) return;
    const routeId = this.suspended ? null : getReelId(location.href);
    if (!routeId) this.cache.clear();
    const id =
      this.suspended || !this.settingsReady || !this.settings.showDate ? null : routeId;
    if (id === this.activeId) return;
    const wasActive = this.activeId !== null;
    this.activeId = id;
    if (!id) this.diagnostics.update(null, 'inactive');
    this.view.clear();
    window.clearTimeout(this.refreshTimer);
    this.refreshTimer = undefined;
    // Also synchronize MAIN when polling detects an exit that bypassed its hooks.
    this.announce();
    if (!id) {
      this.observer.disconnect();
      window.removeEventListener('scroll', this.scheduleRefresh, true);
      window.removeEventListener('resize', this.scheduleRefresh);
      this.seenScripts = new WeakSet();
      return;
    }
    if (!wasActive) {
      this.observer.observe(document, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['href', 'src', 'poster', 'hidden', 'aria-hidden', 'role'],
      });
      window.addEventListener('scroll', this.scheduleRefresh, {
        capture: true,
        passive: true,
      });
      window.addEventListener('resize', this.scheduleRefresh, { passive: true });
    }
    this.scheduleRefresh();
  };

  private onMessage = (event: MessageEvent): void => {
    if (this.disposed) return;
    const message = bridgeMessage(event);
    if (!message) return;
    if (message.type === 'navigation') {
      this.syncRoute();
      return;
    }
    if (
      message.type !== 'records' ||
      this.suspended ||
      !this.settingsReady ||
      !this.settings.showDate ||
      !getReelId(location.href)
    )
      return;
    this.syncRoute();
    this.cache.add(message.records);
    this.scheduleRefresh();
  };

  private suspend = (): void => {
    this.suspended = true;
    this.stopSettings?.();
    this.stopSettings = undefined;
    this.settingsReady = false;
    this.announce();
    window.clearInterval(this.routePoll);
    this.routePoll = undefined;
    this.syncRoute();
  };

  private resume = (): void => {
    if (this.disposed) return;
    this.suspended = false;
    this.startSettings();
    this.routePoll ??= window.setInterval(this.syncRoute, 500);
    this.syncRoute();
  };
}

ReelDateController.start();

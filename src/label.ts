import { formatDate, formatRelative } from './formatting';
import { resolveLocale, translations } from './i18n';
import type { Settings } from './settings';

export function createLabel(
  seconds: number | undefined,
  settings: Settings,
  scale = 1,
  aiGenerated = false,
): HTMLSpanElement {
  const locale = resolveLocale().locale;
  const host = document.createElement('span');
  host.lang = locale;
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `:host{display:block;max-width:100%}.label{display:block;box-sizing:border-box;padding:${4 * scale}px ${7 * scale}px;border:${scale}px solid ${settings.borderColor};border-radius:${5 * scale}px;color:${settings.textColor};background:${settings.backgroundColor};font:normal ${settings.fontSize * scale}px/1.4 system-ui,sans-serif;overflow-wrap:anywhere;text-align:inherit}time,[data-relative],[data-missing-date]{display:block}[data-relative]{font-size:.9em;opacity:.85;margin-top:${2 * scale}px}[data-ai]{display:inline-block;font-size:.85em;line-height:1.3;border:${scale}px solid currentColor;border-radius:${8 * scale}px;padding:${2 * scale}px ${5 * scale}px;margin-top:${4 * scale}px}`;
  const label = document.createElement('span');
  label.className = 'label';
  if (seconds !== undefined) {
    const time = document.createElement('time');
    time.dateTime = new Date(seconds * 1000).toISOString();
    time.textContent = `${translations().published} ${formatDate(seconds, locale)}`;
    label.append(time);
  } else {
    const missing = document.createElement('span');
    missing.dataset.missingDate = '';
    missing.textContent = translations().dateUnavailable;
    label.append(missing);
  }
  if (settings.showRelative && seconds !== undefined) {
    const relative = document.createElement('span');
    relative.dataset.relative = '';
    relative.textContent = formatRelative(seconds, locale);
    label.append(relative);
  }
  if (settings.showAiBadge && aiGenerated) {
    const badge = document.createElement('span');
    badge.dataset.ai = '';
    badge.textContent = translations().aiBadge;
    badge.title = translations().aiDescription;
    badge.setAttribute('aria-label', translations().aiDescription);
    label.append(badge);
  }
  shadow.append(style, label);
  return host;
}

import { getReelId, type ReelRecord } from './data';
import { createLabel } from './label';
import { resolveLocale } from './i18n';
import { Placement } from './placement';
import { DEFAULT_SETTINGS, type Settings } from './settings';
import type { DiagnosticStatus } from './diagnostics';

const BADGE = '[data-fb-reel-date]';

function visible(element: HTMLElement): boolean {
  if (element.closest('[hidden], [aria-hidden="true"], [inert]')) return false;
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return (
    rect.width > 1 &&
    rect.height > 1 &&
    style.visibility !== 'hidden' &&
    style.display !== 'none'
  );
}

function visibleArea(video: HTMLVideoElement): number {
  if (!visible(video)) return 0;
  const rect = video.getBoundingClientRect();
  if (rect.width < 120 || rect.height < 120) return 0;
  return (
    Math.max(0, Math.min(rect.right, innerWidth) - Math.max(0, rect.left)) *
    Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(0, rect.top))
  );
}

export function findHeading(): {
  video: HTMLVideoElement;
  heading: HTMLElement;
  container: HTMLElement;
} | null {
  let candidates = [...document.querySelectorAll('video')]
    .slice(0, 32)
    .map((video) => ({ video, area: visibleArea(video) }))
    .filter((item) => item.area > 0);
  const modal = candidates.filter((item) => item.video.closest('[role="dialog"]'));
  if (modal.length) candidates = modal;
  candidates.sort((a, b) => b.area - a.area);
  const best = candidates[0];
  if (!best || (candidates[1] && candidates[1].area > best.area * 0.8)) return null;
  let parent = best.video.parentElement;
  for (
    let depth = 0;
    parent && parent !== document.body && depth < 16;
    depth++, parent = parent.parentElement
  ) {
    if (parent.querySelectorAll('video').length > 1) return null;
    const headings = [
      ...parent.querySelectorAll<HTMLElement>('h1, h2, h3, [role="heading"]'),
    ].filter((heading) => {
      const link = heading.querySelector<HTMLAnchorElement>('a[href]');
      return (
        visible(heading) &&
        link &&
        new URL(link.href).origin === location.origin &&
        !getReelId(link.href) &&
        heading.textContent!.trim().length > 0 &&
        heading.textContent!.length < 200
      );
    });
    if (headings.length === 1 && headings[0])
      return { video: best.video, heading: headings[0], container: parent };
    if (headings.length > 1 || parent.matches('[role="main"], [role="dialog"]'))
      return null;
  }
  return null;
}

export class DateView {
  private badge: HTMLElement | null = null;
  private identity = new WeakMap<HTMLVideoElement, { id: string; signature: string }>();
  private placement = new Placement();

  clear(): void {
    this.badge?.remove();
    this.badge = null;
    this.placement.restore();
  }

  render(
    record: ReelRecord | null,
    settings: Settings = DEFAULT_SETTINGS,
  ): DiagnosticStatus {
    const routeId = getReelId(location.href);
    if (!routeId || !settings.showDate) {
      this.clear();
      return 'inactive';
    }
    // Choose the active Reel using its original dimensions, before our own scaling.
    this.placement.restore();
    const target = findHeading();
    if (!target) {
      this.clear();
      return 'target_missing';
    }
    const { video, heading, container } = target;
    const linkedReelId = getReelId(
      video.closest<HTMLAnchorElement>('a[href]')?.href ?? '',
    );
    if (linkedReelId && linkedReelId !== routeId) {
      this.clear();
      return 'reel_mismatch';
    }
    const signature = [
      video.currentSrc,
      video.getAttribute('src'),
      video.getAttribute('poster'),
      heading.textContent,
      heading.querySelector('a')?.href,
    ].join('|');
    const previous = this.identity.get(video);
    if (previous && previous.id !== routeId && previous.signature === signature) {
      this.clear();
      return 'stale_player';
    }
    this.identity.set(video, { id: routeId, signature });
    if (
      !record ||
      record.videoId !== routeId ||
      (record.publishTime === undefined && !record.dateUnavailable)
    ) {
      this.clear();
      return 'metadata_missing';
    }
    const key = JSON.stringify([
      record.videoId,
      record.publishTime,
      record.dateUnavailable,
      record.aiGenerated,
      settings,
      resolveLocale().locale,
      settings.showRelative ? Math.floor(Date.now() / 60_000) : 0,
    ]);
    if (
      this.badge?.isConnected &&
      this.badge.dataset.fbReelDate === key &&
      (settings.position !== 'author' || this.badge.previousElementSibling === heading)
    ) {
      if (!this.placement.update(this.badge, video, container, settings.position)) {
        this.clear();
        return 'placement_failed';
      }
      return 'shown';
    }
    this.clear();
    document.querySelectorAll(BADGE).forEach((element) => element.remove());
    const badge = createLabel(
      record.publishTime,
      settings,
      1,
      record.aiGenerated === true,
    );
    badge.dataset.fbReelDate = key;
    badge.dataset.position = settings.position;
    badge.style.cssText = 'display:block;max-width:340px;margin-top:4px;line-height:1.4;';
    if (settings.position === 'author') heading.after(badge);
    else document.body.append(badge);
    this.badge = badge;
    if (!this.placement.update(badge, video, container, settings.position)) {
      this.clear();
      return 'placement_failed';
    }
    return 'shown';
  }
}

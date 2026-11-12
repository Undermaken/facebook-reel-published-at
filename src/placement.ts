import type { Position } from './settings';

export class Placement {
  private resized: {
    element: HTMLElement;
    original: string;
    priority: string;
    applied: string;
  } | null = null;

  restore(): void {
    const state = this.resized;
    if (state && state.element.style.getPropertyValue('scale') === state.applied) {
      if (state.original)
        state.element.style.setProperty('scale', state.original, state.priority);
      else state.element.style.removeProperty('scale');
    }
    this.resized = null;
  }

  update(
    badge: HTMLElement,
    video: HTMLVideoElement,
    container: HTMLElement,
    position: Position,
  ): boolean {
    this.restore();
    if (position === 'author') return true;
    badge.style.cssText =
      'position:fixed;z-index:2147483646;transform:translateX(-50%);width:max-content;text-align:center;pointer-events:none;';
    const baseline = video.getBoundingClientRect();
    const computed = getComputedStyle(container);
    const scales =
      computed.scale === 'none' ? [1, 1] : computed.scale.split(' ').map(Number);
    const scaleX = scales[0] ?? 1;
    const scaleY = scales[1] ?? scaleX;
    const originY = Number.parseFloat(computed.transformOrigin.split(' ')[1] ?? '0');
    const bottomGain =
      baseline.bottom - (container.getBoundingClientRect().top + originY * scaleY);
    let factor = 1;
    for (let attempt = 0; attempt < 5; attempt++) {
      const rect = video.getBoundingClientRect();
      badge.style.maxWidth = `${Math.max(80, Math.min(480, rect.width - 20, innerWidth - 16))}px`;
      const height = badge.getBoundingClientRect().height;
      const overflow = rect.bottom + 8 + height - (innerHeight - 8);
      if (position !== 'bottom' || overflow <= 0.5) {
        badge.style.left = `${rect.left + rect.width / 2}px`;
        badge.style.top = `${position === 'top' ? Math.max(8, rect.top + 12) : rect.bottom + 8}px`;
        return true;
      }
      if (bottomGain <= 0 || !Number.isFinite(scaleX + scaleY)) break;
      factor -= (overflow + 1) / bottomGain;
      if (factor < Math.max(0.35, 121 / baseline.height)) break;
      if (!this.resized) {
        this.resized = {
          element: container,
          original: container.style.getPropertyValue('scale'),
          priority: container.style.getPropertyPriority('scale'),
          applied: '',
        };
      }
      container.style.setProperty(
        'scale',
        `${scaleX * factor} ${scaleY * factor}`,
        'important',
      );
      this.resized.applied = container.style.getPropertyValue('scale');
    }
    this.restore();
    return false;
  }
}

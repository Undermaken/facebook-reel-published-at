import {
  FACEBOOK_ORIGIN,
  isTimestamp,
  isVideoId,
  MAX_RECORDS,
  mergeRecords,
  object,
  type ReelRecord,
} from './data';

export const CHANNEL = 'facebook-reel-date/v1';

export function bridgeMessage(event: MessageEvent): Record<string, unknown> | null {
  if (event.source !== window || event.origin !== FACEBOOK_ORIGIN) return null;
  const value = object(event.data);
  return value?.channel === CHANNEL ? value : null;
}

export function readRecords(value: unknown): ReelRecord[] {
  if (!Array.isArray(value) || value.length > MAX_RECORDS) return [];
  const records: ReelRecord[] = [];
  for (const item of value) {
    const record = object(item);
    if (
      !record ||
      !isVideoId(record.videoId) ||
      (record.publishTime !== undefined && !isTimestamp(record.publishTime)) ||
      (record.aiGenerated !== undefined && typeof record.aiGenerated !== 'boolean') ||
      (record.dateUnavailable !== undefined && record.dateUnavailable !== true) ||
      (record.publishTime === undefined &&
        record.aiGenerated === undefined &&
        record.dateUnavailable !== true)
    )
      return [];
    records.push({
      videoId: record.videoId,
      ...(isTimestamp(record.publishTime)
        ? { publishTime: record.publishTime }
        : record.dateUnavailable === true
          ? { dateUnavailable: true }
          : {}),
      ...(typeof record.aiGenerated === 'boolean'
        ? { aiGenerated: record.aiGenerated }
        : {}),
    });
  }
  return records;
}

export function post(
  type: 'ready' | 'navigation' | 'records',
  records: ReelRecord[] = [],
  enabled?: boolean,
): void {
  window.postMessage(
    { channel: CHANNEL, type, records, ...(enabled === undefined ? {} : { enabled }) },
    FACEBOOK_ORIGIN,
  );
}

export class RecordStore {
  private entries = new Map<string, { record: ReelRecord | null; expires: number }>();

  add(records: ReelRecord[]): void {
    for (const record of records) {
      const previous = this.entries.get(record.videoId);
      const merged = mergeRecords(
        previous && previous.expires > Date.now() ? previous.record : undefined,
        record,
      );
      this.entries.delete(record.videoId);
      this.entries.set(record.videoId, {
        record: merged,
        expires: Date.now() + 30 * 60_000,
      });
      if (this.entries.size > 200) {
        const oldest = this.entries.keys().next().value;
        if (oldest !== undefined) this.entries.delete(oldest);
      }
    }
  }

  get(videoId: string): ReelRecord | null {
    const entry = this.entries.get(videoId);
    if (entry && entry.expires <= Date.now()) this.entries.delete(videoId);
    return entry?.record && entry.expires > Date.now() ? { ...entry.record } : null;
  }

  recent(): ReelRecord[] {
    return [...this.entries.keys()]
      .reverse()
      .slice(0, MAX_RECORDS)
      .flatMap((id) => this.get(id) ?? []);
  }

  clear(): void {
    this.entries.clear();
  }
}

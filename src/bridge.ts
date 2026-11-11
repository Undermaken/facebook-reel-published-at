import { FACEBOOK_ORIGIN, MAX_RECORDS, mergeRecords, type ReelRecord } from './data';
import './zod-config';
import * as z from 'zod';
import { reelRecordSchema } from './schemas';

export const CHANNEL = 'facebook-reel-date/v1';
const recordsSchema = z
  .custom<unknown[]>(Array.isArray)
  .refine((records) => records.length <= MAX_RECORDS)
  .pipe(z.array(reelRecordSchema));
const channel = z.literal(CHANNEL);
const messageSchema = z.discriminatedUnion('type', [
  z.object({ channel, type: z.literal('ready'), enabled: z.boolean() }),
  z.object({ channel, type: z.literal('navigation') }),
  z.object({ channel, type: z.literal('records'), records: recordsSchema }),
]);

export function bridgeMessage(event: MessageEvent): z.infer<typeof messageSchema> | null {
  if (event.source !== window || event.origin !== FACEBOOK_ORIGIN) return null;
  return messageSchema.safeParse(event.data).data ?? null;
}

export function readRecords(value: unknown): ReelRecord[] {
  return recordsSchema.safeParse(value).data ?? [];
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

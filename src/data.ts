import {
  containerSchema,
  readEnvelope,
  storySchema,
  trackingSchema,
  type FacebookStory,
  type ReelRecord,
} from './schemas';
export type { ReelRecord } from './schemas';

export const FACEBOOK_ORIGIN = 'https://www.facebook.com';
export const MAX_FRAME_CHARS = 2 * 1024 * 1024;
export const MAX_RECORDS = 64;

function recordFromStory(node: FacebookStory): ReelRecord | null {
  const aiGenerated = node.ai_generated_detected_info?.was_detected_as_ai_generated;
  if (node.tracking === undefined && aiGenerated === undefined) return null;
  const identities = [
    node,
    node.video,
    node.media,
    ...(node.attachments ?? []).map((attachment) => attachment.media),
  ];
  const ids = new Set<string>();
  const owners = new Set<string>();
  for (const item of identities) {
    if (!item) continue;
    if (item.video_id) ids.add(item.video_id);
    if ((item !== node || item.__typename === 'Video') && item.id) ids.add(item.id);
    for (const value of [item.shareable_url, item.url]) {
      const id = value ? getReelId(value) : null;
      if (id) ids.add(id);
    }
    if (item.owner?.id) owners.add(item.owner.id);
  }
  if (ids.size !== 1) return null;
  const videoId = ids.values().next().value!;
  const publication = publicationFromTracking(node.tracking, owners);
  if (
    !publication.publishTime &&
    !publication.dateUnavailable &&
    aiGenerated === undefined
  )
    return null;
  return {
    videoId,
    ...publication,
    ...(aiGenerated === undefined ? {} : { aiGenerated }),
  };
}

function publicationFromTracking(
  value: unknown,
  owners: Set<string>,
): Pick<ReelRecord, 'publishTime' | 'dateUnavailable'> {
  const parsed = trackingSchema.safeParse(value);
  if (!parsed.success) return {};
  const times = new Set<number>();
  const contexts = Object.entries(parsed.data.page_insights)
    .slice(0, 64)
    .filter(([owner]) => !owners.size || owners.has(owner))
    .map(([, insight]) => insight.post_context);
  for (const context of contexts) {
    const time = context?.publish_time;
    if (time !== undefined && time !== null) times.add(time);
  }
  const publishTime = times.values().next().value;
  if (times.size === 1 && publishTime !== undefined) return { publishTime };
  // Omitted, malformed or unfinished metadata is not evidence of absence.
  return owners.size === 1 && contexts.length === 1 && contexts[0]?.publish_time === null
    ? { dateUnavailable: true }
    : {};
}

export function mergeRecords(
  previous: ReelRecord | null | undefined,
  record: ReelRecord,
): ReelRecord | null {
  if (
    previous === null ||
    (previous?.publishTime !== undefined &&
      record.publishTime !== undefined &&
      previous.publishTime !== record.publishTime)
  )
    return null;
  const publishTime = record.publishTime ?? previous?.publishTime;
  // Contradictory explicit AI flags suppress the badge until the cache expires.
  const aiGenerated =
    previous?.aiGenerated === false || record.aiGenerated === false
      ? false
      : (record.aiGenerated ?? previous?.aiGenerated);
  return {
    videoId: record.videoId,
    ...(publishTime !== undefined
      ? { publishTime }
      : previous?.dateUnavailable || record.dateUnavailable
        ? { dateUnavailable: true as const }
        : {}),
    ...(aiGenerated === undefined ? {} : { aiGenerated }),
  };
}

export function extractRecords(
  value: unknown,
  includePendingAbsence = false,
): ReelRecord[] {
  // Network readers defer root-envelope absence until transport completion.
  // Nested incomplete envelopes still cannot establish absence.
  const pending = [{ value, depth: 0, incomplete: false }];
  const seen = new WeakSet<object>();
  const found = new Map<string, ReelRecord | null>();
  let visited = 0;
  while (pending.length && visited++ < 30_000) {
    const entry = pending.pop();
    if (!entry || entry.depth > 80) continue;
    const container = containerSchema.parse(entry.value);
    if (!container || seen.has(container)) continue;
    seen.add(container);
    const node =
      'tracking' in container || 'ai_generated_detected_info' in container
        ? storySchema.safeParse(container).data
        : undefined;
    const envelope = readEnvelope(container);
    const incomplete =
      entry.incomplete ||
      envelope.failed ||
      (!(includePendingAbsence && entry.depth === 0) && envelope.pending);
    let record = node ? recordFromStory(node) : null;
    if (record?.dateUnavailable && incomplete) {
      record =
        record.aiGenerated === undefined
          ? null
          : { videoId: record.videoId, aiGenerated: record.aiGenerated };
    }
    if (record && (found.has(record.videoId) || found.size < MAX_RECORDS)) {
      found.set(record.videoId, mergeRecords(found.get(record.videoId), record));
    }
    const children = Object.values(container);
    for (
      let index = children.length - 1;
      index >= 0 && pending.length < 30_000;
      index--
    ) {
      const child = containerSchema.parse(children[index]);
      if (child) pending.push({ value: child, depth: entry.depth + 1, incomplete });
    }
  }
  return [...found.values()].flatMap((record) => record ?? []);
}

export class JsonFrames {
  private depth = 0;
  private quoted = false;
  private escaped = false;
  private overflow = false;
  private buffer = '';
  private invalid = false;

  isComplete(): boolean {
    return this.depth === 0 && !this.invalid;
  }

  push(chunk: string): unknown[] {
    const frames: unknown[] = [];
    for (const character of chunk) {
      if (!this.depth) {
        if (character !== '{' && character !== '[') continue;
        this.buffer = character;
        this.depth = 1;
        this.overflow = false;
        continue;
      }
      if (!this.overflow) {
        this.buffer += character;
        if (this.buffer.length > MAX_FRAME_CHARS) {
          this.overflow = true;
          this.invalid = true;
          this.buffer = '';
        }
      }
      if (this.quoted) {
        if (this.escaped) this.escaped = false;
        else if (character === '\\') this.escaped = true;
        else if (character === '"') this.quoted = false;
      } else if (character === '"') this.quoted = true;
      else if (character === '{' || character === '[') this.depth++;
      else if (character === '}' || character === ']') this.depth--;
      if (!this.depth) {
        if (!this.overflow && frames.length < 256) {
          try {
            frames.push(JSON.parse(this.buffer));
          } catch {
            this.invalid = true;
            /* Ignore malformed frames. */
          }
        } else this.invalid = true;
        this.buffer = '';
      }
    }
    return frames;
  }
}

export function getReelId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== FACEBOOK_ORIGIN) return null;
    return /^\/reel\/([1-9]\d{0,29})\/?$/.exec(parsed.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

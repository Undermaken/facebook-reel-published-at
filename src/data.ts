export interface ReelRecord {
  videoId: string;
  publishTime?: number;
  dateUnavailable?: true;
  aiGenerated?: boolean;
}

export const FACEBOOK_ORIGIN = 'https://www.facebook.com';
export const MAX_FRAME_CHARS = 2 * 1024 * 1024;
export const MAX_RECORDS = 64;

export function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function isVideoId(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9]\d{0,29}$/.test(value);
}

export function isTimestamp(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 946684800 &&
    value < 4102444800
  );
}

function recordFromStory(node: Record<string, unknown>): ReelRecord | null {
  const ai = object(node.ai_generated_detected_info)?.was_detected_as_ai_generated;
  if (typeof node.tracking !== 'string' && typeof ai !== 'boolean') return null;
  const identities = [node, object(node.video), object(node.media)];
  if (Array.isArray(node.attachments)) {
    for (const attachment of node.attachments.slice(0, 16))
      identities.push(object(object(attachment)?.media));
  }
  const ids = new Set<string>();
  const owners = new Set<string>();
  for (const item of identities) {
    if (!item) continue;
    if (isVideoId(item.video_id)) ids.add(item.video_id);
    if ((item !== node || item.__typename === 'Video') && isVideoId(item.id))
      ids.add(item.id);
    for (const value of [item.shareable_url, item.url]) {
      const id = typeof value === 'string' ? getReelId(value) : null;
      if (id) ids.add(id);
    }
    const owner = object(item.owner)?.id;
    if (isVideoId(owner)) owners.add(owner);
  }
  if (ids.size !== 1) return null;
  const videoId = ids.values().next().value!;
  const aiGenerated = typeof ai === 'boolean' ? ai : undefined;
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
  if (typeof value !== 'string' || value.length > 65_536) return {};
  let tracking: unknown;
  try {
    tracking = JSON.parse(value);
  } catch {
    return {};
  }
  const insights = object(object(tracking)?.page_insights);
  if (!insights) return {};
  const times = new Set<number>();
  const contexts: (Record<string, unknown> | null)[] = [];
  for (const [owner, insight] of Object.entries(insights).slice(0, 64)) {
    if (owners.size && !owners.has(owner)) continue;
    const context = object(object(insight)?.post_context);
    contexts.push(context);
    const time = context?.publish_time;
    if (isTimestamp(time)) times.add(time);
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
    if (
      !entry ||
      entry.depth > 80 ||
      !entry.value ||
      typeof entry.value !== 'object' ||
      seen.has(entry.value)
    )
      continue;
    seen.add(entry.value);
    const node = object(entry.value);
    const incomplete =
      entry.incomplete ||
      (Array.isArray(node?.errors) && node.errors.length > 0) ||
      (!(includePendingAbsence && entry.depth === 0) &&
        (node?.hasNext === true || object(node?.extensions)?.is_final === false));
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
    const children = Object.values(entry.value);
    for (
      let index = children.length - 1;
      index >= 0 && pending.length < 30_000;
      index--
    ) {
      const child: unknown = children[index];
      if (child && typeof child === 'object')
        pending.push({ value: child, depth: entry.depth + 1, incomplete });
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

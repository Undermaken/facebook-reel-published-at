import './zod-config';
import * as z from 'zod';

export const videoIdSchema = z.string().regex(/^[1-9]\d{0,29}$/);
const timestampSchema = z.int().min(946684800).lt(4102444800);
const optionalField = <T extends z.ZodType>(schema: T) =>
  schema.optional().catch(undefined);

const reelFieldsSchema = z.object({
  videoId: videoIdSchema,
  publishTime: timestampSchema.optional(),
  dateUnavailable: z.literal(true).optional(),
  aiGenerated: z.boolean().optional(),
});
export type ReelRecord = z.infer<typeof reelFieldsSchema>;

export const reelRecordSchema = reelFieldsSchema
  .refine(
    (record) =>
      record.publishTime !== undefined ||
      record.dateUnavailable ||
      record.aiGenerated !== undefined,
  )
  .transform(({ dateUnavailable, ...record }): ReelRecord =>
    record.publishTime === undefined && dateUnavailable
      ? { ...record, dateUnavailable }
      : record,
  );

const identitySchema = z.object({
  __typename: optionalField(z.string()),
  video_id: optionalField(videoIdSchema),
  id: optionalField(videoIdSchema),
  shareable_url: optionalField(z.string()),
  url: optionalField(z.string()),
  owner: optionalField(z.object({ id: optionalField(videoIdSchema) })),
});
const attachmentSchema = z.object({ media: optionalField(identitySchema) }).catch({});

export const storySchema = identitySchema.extend({
  tracking: optionalField(z.string()),
  video: optionalField(identitySchema),
  media: optionalField(identitySchema),
  attachments: optionalField(
    z
      .custom<unknown[]>(Array.isArray)
      .transform((items) => items.slice(0, 16))
      .pipe(z.array(attachmentSchema)),
  ),
  ai_generated_detected_info: optionalField(
    z.object({
      was_detected_as_ai_generated: optionalField(z.boolean()),
    }),
  ),
});
export type FacebookStory = z.infer<typeof storySchema>;

const insightSchema = z
  .object({
    post_context: optionalField(
      z.object({
        publish_time: optionalField(timestampSchema.nullable()),
      }),
    ),
  })
  .catch({});

export const trackingSchema = z
  .string()
  .refine((text) => text.length <= 65_536)
  .transform((text): unknown => {
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  })
  .pipe(z.object({ page_insights: z.record(z.string(), insightSchema) }));

const envelopeSchema = z.object({
  hasNext: optionalField(z.boolean()),
  extensions: optionalField(z.object({ is_final: optionalField(z.boolean()) })),
  errors: optionalField(z.array(z.unknown())),
});

export function readEnvelope(value: unknown) {
  const envelope = envelopeSchema.safeParse(value).data;
  return {
    pending: envelope?.hasNext === true || envelope?.extensions?.is_final === false,
    complete: envelope?.hasNext === false || envelope?.extensions?.is_final === true,
    failed: Boolean(envelope?.errors?.length),
  };
}

// Keep object identities intact so cyclic input cannot bypass traversal limits.
export const containerSchema = z
  .custom<object | null>((value) => value !== null && typeof value === 'object')
  .catch(null);

import './zod-config';
import * as z from 'zod';

const colorSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i)
  .toLowerCase();
const settingsSchema = z.object({
  position: z.enum(['author', 'top', 'bottom']).catch('author'),
  textColor: colorSchema.catch('#ffffff'),
  fontSize: z.int().min(10).max(24).catch(12),
  backgroundColor: colorSchema.catch('#111827'),
  borderColor: colorSchema.catch('#374151'),
  showRelative: z.boolean().catch(false),
  showAiBadge: z.boolean().catch(false),
  showDate: z.boolean().catch(true),
});
export type Settings = z.infer<typeof settingsSchema>;
export type Position = Settings['position'];
export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({});

export const SETTINGS_KEY = 'appearance';

export function normalizeSettings(value: unknown): Settings {
  return settingsSchema.safeParse(value).data ?? { ...DEFAULT_SETTINGS };
}

export function subscribeSettings(onChange: (settings: Settings) => void): () => void {
  let active = true;
  let revision = 0;
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (active && area === 'local' && SETTINGS_KEY in changes) {
      revision++;
      onChange(normalizeSettings(changes[SETTINGS_KEY]?.newValue));
    }
  };
  chrome.storage.onChanged.addListener(listener);
  void chrome.storage.local
    .get(SETTINGS_KEY)
    .then((values) => {
      if (active && revision === 0) onChange(normalizeSettings(values[SETTINGS_KEY]));
    })
    .catch(() => {
      if (active && revision === 0) onChange({ ...DEFAULT_SETTINGS });
    });
  return () => {
    active = false;
    chrome.storage.onChanged.removeListener(listener);
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: normalizeSettings(settings) });
}

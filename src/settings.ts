export type Position = 'author' | 'top' | 'bottom';

export interface Settings {
  position: Position;
  textColor: string;
  fontSize: number;
  backgroundColor: string;
  borderColor: string;
  showRelative: boolean;
  showAiBadge: boolean;
  showDate: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  position: 'author',
  textColor: '#ffffff',
  fontSize: 12,
  backgroundColor: '#111827',
  borderColor: '#374151',
  showRelative: false,
  showAiBadge: false,
  showDate: true,
};

export const SETTINGS_KEY = 'appearance';

export function normalizeSettings(value: unknown): Settings {
  const input =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const color = (candidate: unknown, fallback: string) =>
    typeof candidate === 'string' && /^#[0-9a-f]{6}$/i.test(candidate)
      ? candidate.toLowerCase()
      : fallback;
  return {
    position:
      input.position === 'top' || input.position === 'bottom' ? input.position : 'author',
    textColor: color(input.textColor, DEFAULT_SETTINGS.textColor),
    backgroundColor: color(input.backgroundColor, DEFAULT_SETTINGS.backgroundColor),
    borderColor: color(input.borderColor, DEFAULT_SETTINGS.borderColor),
    fontSize:
      typeof input.fontSize === 'number' &&
      Number.isInteger(input.fontSize) &&
      input.fontSize >= 10 &&
      input.fontSize <= 24
        ? input.fontSize
        : DEFAULT_SETTINGS.fontSize,
    showRelative: input.showRelative === true,
    showAiBadge: input.showAiBadge === true,
    showDate: input.showDate !== false,
  };
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

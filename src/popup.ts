import '../popup.css';
import { subWeeks } from 'date-fns';
import { resolveLocale, translations, type Messages } from './i18n';
import { createLabel } from './label';
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  saveSettings,
  subscribeSettings,
  type Position,
} from './settings';

const text = translations();
document.documentElement.lang = resolveLocale().locale;
document.title = text.title;
document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
  element.textContent = text[element.dataset.i18n as keyof Messages];
});
const form = document.querySelector<HTMLFormElement>('#settings-form')!;
const color = document.querySelector<HTMLInputElement>('#text-color')!;
const size = document.querySelector<HTMLInputElement>('#font-size')!;
const background = document.querySelector<HTMLInputElement>('#background-color')!;
const border = document.querySelector<HTMLInputElement>('#border-color')!;
const relative = document.querySelector<HTMLInputElement>('#show-relative')!;
const ai = document.querySelector<HTMLInputElement>('#show-ai-badge')!;
const visibility = document.querySelector<HTMLInputElement>('#show-date')!;
const status = document.querySelector<HTMLElement>('#status')!;
const mockup = document.querySelector<HTMLElement>('#mockup')!;
const positions = [...document.querySelectorAll<HTMLButtonElement>('[data-position]')];
mockup.setAttribute('aria-label', text.preview);
let settings = { ...DEFAULT_SETTINGS };
let pending = 0;
let revision = 0;
const sampleDate = Math.floor(subWeeks(new Date(), 1).getTime() / 1000);
const controls = [...form.querySelectorAll<HTMLInputElement>('input'), ...positions];
controls.forEach((control) => {
  control.disabled = true;
});

function render() {
  color.value = settings.textColor;
  size.value = String(settings.fontSize);
  background.value = settings.backgroundColor;
  border.value = settings.borderColor;
  relative.checked = settings.showRelative;
  ai.checked = settings.showAiBadge;
  visibility.checked = settings.showDate;
  document.querySelector('#font-size-value')!.textContent = `${settings.fontSize} px`;
  for (const button of positions) {
    const position = button.dataset.position as Position;
    const selected = position === settings.position;
    button.setAttribute('aria-label', text[position]);
    button.setAttribute('aria-pressed', String(selected));
    button.title = text[position];
    button.replaceChildren(
      selected && settings.showDate
        ? createLabel(sampleDate, settings, 0.55, true)
        : document.createTextNode(text[position]),
    );
  }
  const bottom = positions.find((button) => button.dataset.position === 'bottom')!;
  mockup.style.height = `${Math.max(400, bottom.offsetTop + bottom.offsetHeight + 8)}px`;
}

function persist() {
  settings = normalizeSettings({
    ...settings,
    textColor: color.value,
    fontSize: Number(size.value),
    backgroundColor: background.value,
    borderColor: border.value,
    showRelative: relative.checked,
    showAiBadge: ai.checked,
    showDate: visibility.checked,
  });
  render();
  const current = ++revision;
  pending++;
  status.textContent = text.saving;
  void saveSettings(settings)
    .then(() => {
      if (current === revision)
        status.textContent = settings.showDate ? text.saved : text.paused;
    })
    .catch(() => {
      if (current === revision) status.textContent = text.saveError;
    })
    .finally(() => {
      pending--;
    });
}

form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('input', persist);
for (const button of positions) {
  button.addEventListener('click', () => {
    settings = { ...settings, position: button.dataset.position as Position };
    persist();
  });
}
const unsubscribe = subscribeSettings((value) => {
  if (pending) return;
  settings = value;
  controls.forEach((control) => {
    control.disabled = false;
  });
  render();
  status.textContent = settings.showDate ? text.saved : text.paused;
});
window.addEventListener('pagehide', unsubscribe, { once: true });

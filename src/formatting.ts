import { intlFormat, intlFormatDistance } from 'date-fns';
import { resolveLocale, translations } from './i18n';

export function formatDate(seconds: number, locale = navigator.language): string {
  return intlFormat(
    new Date(seconds * 1000),
    { dateStyle: 'long', timeStyle: 'medium' },
    { locale: resolveLocale(locale).locale },
  );
}

export function formatRelative(
  seconds: number,
  locale = navigator.language,
  now = Date.now(),
): string {
  if (Math.abs(now - seconds * 1000) < 5000) return translations(locale).justNow;
  return intlFormatDistance(new Date(seconds * 1000), new Date(now), {
    locale: resolveLocale(locale).locale,
    numeric: 'always',
  });
}

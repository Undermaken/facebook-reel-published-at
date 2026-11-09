import { describe, expect, it } from 'vitest';
import { formatDate, formatRelative } from '../../src/formatting';
import { resolveLocale } from '../../src/i18n';

describe('browser locale', () => {
  it.each([
    ['it-IT', 'it', 'it-IT'],
    ['en-GB', 'en', 'en-GB'],
    ['es-MX', 'es', 'es-MX'],
    ['de-AT', 'de', 'de-AT'],
    ['fr-CA', 'fr', 'fr-CA'],
    ['pt-BR', 'en', 'en'],
    ['invalid_locale', 'en', 'en'],
  ])(
    'resolves %s with a regional locale or English fallback',
    (raw, language, locale) => {
      expect(resolveLocale(raw)).toEqual({ language, locale });
    },
  );

  it.each([
    ['it-IT', '15 ottobre 2026'],
    ['en-GB', '15 October 2026'],
    ['es-ES', '15 de octubre de 2026'],
    ['de-DE', '15. Oktober 2026'],
    ['fr-FR', '15 octobre 2026'],
  ])('formats the absolute date in %s without a timezone label', (locale, date) => {
    const text = formatDate(1792070163, locale);
    expect(text).toContain(date);
    expect(text).toContain('15:16:03');
    expect(text).not.toMatch(/GMT|UTC|CEST|CET/);
  });

  it('keeps local daylight saving and regional clock conventions', () => {
    expect(formatDate(1767222000, 'it-IT')).toContain('1 gennaio 2026');
    expect(formatDate(1767222000, 'it-IT')).toContain('00:00:00');
    expect(formatDate(1792070163, 'en-US')).toContain('3:16:03 PM');
    expect(formatDate(1792070163, 'unsupported')).toContain('October');
  });

  it.each([
    ['it-IT', '1 settimana fa', '1 giorno fa', '2 giorni fa'],
    ['en-US', '1 week ago', '1 day ago', '2 days ago'],
    ['es-ES', 'hace 1 semana', 'hace 1 día', 'hace 2 días'],
    ['de-DE', 'vor 1 Woche', 'vor 1 Tag', 'vor 2 Tagen'],
    ['fr-FR', 'il y a 1 semaine', 'il y a 1 jour', 'il y a 2 jours'],
  ])('localizes relative age and plurals in %s', (locale, week, day, days) => {
    const now = Date.parse('2026-11-09T10:00:00Z');
    expect(formatRelative((now - 7 * 86400000) / 1000, locale, now)).toBe(week);
    expect(formatRelative((now - 86400000) / 1000, locale, now)).toBe(day);
    expect(formatRelative((now - 2 * 86400000) / 1000, locale, now)).toBe(days);
  });
});

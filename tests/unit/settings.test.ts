import { describe, expect, it } from 'vitest';
import { normalizeSettings } from '../../src/settings';

describe('appearance preferences', () => {
  it('retains valid appearance choices and ignores unknown fields', () => {
    expect(
      normalizeSettings({
        position: 'bottom',
        textColor: '#AABBCC',
        fontSize: 20,
        backgroundColor: '#123456',
        borderColor: '#ABCDEF',
        showRelative: true,
        showAiBadge: true,
        showDate: false,
        url: 'https://evil.test',
      }),
    ).toEqual({
      position: 'bottom',
      textColor: '#aabbcc',
      fontSize: 20,
      backgroundColor: '#123456',
      borderColor: '#abcdef',
      showRelative: true,
      showAiBadge: true,
      showDate: false,
    });
  });

  it('rejects untrusted CSS, unknown positions and out-of-range sizes', () => {
    expect(
      normalizeSettings({
        position: 'sidebar',
        textColor: 'url(https://evil.test)',
        backgroundColor: 'red;display:none',
        borderColor: 'url(https://evil.test)',
        fontSize: 1000,
        showRelative: 'true',
        showAiBadge: 'true',
        showDate: 'false',
      }),
    ).toEqual({
      position: 'author',
      textColor: '#ffffff',
      fontSize: 12,
      backgroundColor: '#111827',
      borderColor: '#374151',
      showRelative: false,
      showAiBadge: false,
      showDate: true,
    });
    expect(normalizeSettings(null).position).toBe('author');
  });

  it('keeps existing preferences when older settings have no border color', () => {
    expect(
      normalizeSettings({
        position: 'top',
        textColor: '#ffcc00',
        fontSize: 18,
        backgroundColor: '#123456',
        showRelative: true,
      }),
    ).toEqual({
      position: 'top',
      textColor: '#ffcc00',
      fontSize: 18,
      backgroundColor: '#123456',
      borderColor: '#374151',
      showRelative: true,
      showAiBadge: false,
      showDate: true,
    });
  });
});

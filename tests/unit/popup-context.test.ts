import { describe, expect, it } from 'vitest';
import { isReelTab } from '../../src/popup-context';

describe('isReelTab', () => {
  it('accepts only supported Facebook Reel URLs', () => {
    expect(isReelTab('https://www.facebook.com/reel/5532624203628819/')).toBe(true);
    expect(isReelTab('https://www.facebook.com/')).toBe(false);
    expect(isReelTab('https://example.com/reel/5532624203628819')).toBe(false);
    expect(isReelTab(undefined)).toBe(false);
  });
});

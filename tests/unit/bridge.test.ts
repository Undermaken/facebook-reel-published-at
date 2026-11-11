import { afterEach, describe, expect, it, vi } from 'vitest';
import { bridgeMessage, readRecords, RecordStore } from '../../src/bridge';

afterEach(() => vi.useRealTimers());

describe('bridge and bounded storage', () => {
  it('validates each message variant before exposing it to the controller', () => {
    const message = (data: unknown) =>
      bridgeMessage(
        new MessageEvent('message', {
          origin: location.origin,
          source: window,
          data,
        }),
      );
    const channel = 'facebook-reel-date/v1';
    expect(message({ channel, type: 'ready', enabled: false })).toEqual({
      channel,
      type: 'ready',
      enabled: false,
    });
    expect(message({ channel, type: 'navigation' })).toEqual({
      channel,
      type: 'navigation',
    });
    expect(message({ channel, type: 'records', records: [] })).toEqual({
      channel,
      type: 'records',
      records: [],
    });
    for (const data of [
      null,
      [],
      { channel, type: 'ready' },
      { channel, type: 'ready', enabled: 'false' },
      { channel, type: 'records' },
      { channel, type: 'records', records: {} },
      { channel, type: 'records', records: [{ videoId: '123456' }] },
      { channel, type: 'unknown' },
      { channel: 'other', type: 'navigation' },
    ])
      expect(message(data)).toBeNull();
  });

  it('validates confirmed absence and replaces it when the real date arrives', () => {
    expect(readRecords([{ videoId: '123456', dateUnavailable: true }])).toEqual([
      { videoId: '123456', dateUnavailable: true },
    ]);
    expect(readRecords([{ videoId: '123456', dateUnavailable: 'true' }])).toEqual([]);
    const store = new RecordStore();
    store.add([{ videoId: '123456', dateUnavailable: true, aiGenerated: true }]);
    store.add([{ videoId: '123456', publishTime: 1792070163 }]);
    store.add([{ videoId: '123456', dateUnavailable: true }]);
    expect(store.get('123456')).toEqual({
      videoId: '123456',
      publishTime: 1792070163,
      aiGenerated: true,
    });
  });

  it('validates optional AI metadata without accepting truthy strings or empty records', () => {
    expect(readRecords([{ videoId: '123456', aiGenerated: true }])).toEqual([
      { videoId: '123456', aiGenerated: true },
    ]);
    expect(
      readRecords([{ videoId: '123456', publishTime: 1792070163, aiGenerated: true }]),
    ).toEqual([{ videoId: '123456', publishTime: 1792070163, aiGenerated: true }]);
    for (const value of ['true', 1, null, {}]) {
      expect(
        readRecords([{ videoId: '123456', publishTime: 1792070163, aiGenerated: value }]),
      ).toEqual([]);
    }
    expect(readRecords([{ videoId: '123456' }])).toEqual([]);
  });

  it('merges deferred dates and AI flags without carrying metadata across videos', () => {
    const store = new RecordStore();
    store.add([{ videoId: '123456', aiGenerated: true }]);
    store.add([{ videoId: '123456', publishTime: 1792070163 }]);
    store.add([{ videoId: '654321', publishTime: 1792070163 }]);
    expect(store.get('123456')).toEqual({
      videoId: '123456',
      publishTime: 1792070163,
      aiGenerated: true,
    });
    expect(store.get('654321')).toEqual({ videoId: '654321', publishTime: 1792070163 });
    store.add([{ videoId: '123456', aiGenerated: false }]);
    store.add([{ videoId: '123456', aiGenerated: true }]);
    expect(store.get('123456')?.aiGenerated).toBe(false);
  });

  it('accepts only same-window, same-origin messages with a bounded strict payload', () => {
    const data = { channel: 'facebook-reel-date/v1', type: 'records' };
    expect(
      bridgeMessage(
        new MessageEvent('message', {
          origin: 'https://evil.test',
          source: window,
          data,
        }),
      ),
    ).toBeNull();
    expect(
      bridgeMessage(
        new MessageEvent('message', { origin: location.origin, source: null, data }),
      ),
    ).toBeNull();
    expect(readRecords([{ videoId: '123456', publishTime: '<script>' }])).toEqual([]);
    expect(
      readRecords(
        Array.from({ length: 65 }, () => ({
          videoId: '123456',
          publishTime: 1792070163,
        })),
      ),
    ).toEqual([]);
    expect(
      readRecords([{ videoId: '123456', publishTime: 1792070163, html: '<img>' }]),
    ).toEqual([{ videoId: '123456', publishTime: 1792070163 }]);
  });

  it('evicts old records and expires metadata without retaining a browsing history', () => {
    vi.useFakeTimers();
    const store = new RecordStore();
    for (let i = 1; i <= 201; i++)
      store.add([{ videoId: String(i), publishTime: 1792070163 }]);
    expect(store.get('1')).toBeNull();
    expect(store.get('201')).toEqual({ videoId: '201', publishTime: 1792070163 });
    vi.advanceTimersByTime(30 * 60_000 + 1);
    expect(store.get('201')).toBeNull();
  });

  it('suppresses conflicting dates for one video instead of selecting one arbitrarily', () => {
    const store = new RecordStore();
    store.add([{ videoId: '123456', publishTime: 1792070163 }]);
    store.add([{ videoId: '123456', publishTime: 1792070164 }]);
    expect(store.get('123456')).toBeNull();
    store.clear();
    store.add([{ videoId: '123456', publishTime: 1792070163 }]);
    expect(store.get('123456')?.publishTime).toBe(1792070163);
  });
});

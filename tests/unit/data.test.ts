import { describe, expect, it } from 'vitest';
import { extractRecords, getReelId, JsonFrames } from '../../src/data';
import { story, streamedResponse } from '../fixtures/stories';

describe('publication records', () => {
  it('confirms a missing date only from an explicit null in the matched publication context', () => {
    const value = story();
    value.tracking = JSON.stringify({
      page_insights: { '10001': { post_context: { publish_time: null } } },
    });
    expect(extractRecords(value)).toEqual([
      { videoId: '5532624203628819', dateUnavailable: true },
    ]);
    expect(extractRecords({ data: value, extensions: { is_final: false } })).toEqual([]);
    expect(
      extractRecords([{ data: value, extensions: { is_final: false } }], true),
    ).toEqual([]);
    expect(extractRecords({ video_id: '123456', tracking: value.tracking })).toEqual([]);
    value.tracking = JSON.stringify({ page_insights: { '10001': { post_context: {} } } });
    expect(extractRecords(value)).toEqual([]);
    value.tracking = JSON.stringify({
      page_insights: { '10001': { post_context: { publish_time: 'invalid' } } },
    });
    expect(extractRecords(value)).toEqual([]);
  });

  it('reads only an explicit AI boolean belonging to the same identified story', () => {
    expect(
      extractRecords({ data: [story('123456', 1792070163, true), story('654321')] }),
    ).toEqual([
      { videoId: '123456', publishTime: 1792070163, aiGenerated: true },
      { videoId: '654321', publishTime: 1792070163 },
    ]);
    expect(
      extractRecords({
        ...story(),
        ai_generated_detected_info: {
          was_detected_as_ai_generated: 'true',
          gen_ai_transparency_type: 'UNKNOWN',
        },
      }),
    ).toEqual([{ videoId: '5532624203628819', publishTime: 1792070163 }]);
    expect(
      extractRecords({
        ai_generated_detected_info: { was_detected_as_ai_generated: true },
        data: story(),
      }),
    ).toEqual([{ videoId: '5532624203628819', publishTime: 1792070163 }]);
  });

  it('keeps AI metadata when the same story has no publication date', () => {
    const value = { ...story('123456', 1792070163, true), tracking: '' };
    expect(extractRecords(value)).toEqual([{ videoId: '123456', aiGenerated: true }]);
    expect(
      extractRecords({
        ai_generated_detected_info: { was_detected_as_ai_generated: true },
      }),
    ).toEqual([]);
  });

  it('preserves deferred AI information through date-only fragments and suppresses contradictory flags', () => {
    expect(extractRecords([story('123456', 1792070163, true), story('123456')])).toEqual([
      { videoId: '123456', publishTime: 1792070163, aiGenerated: true },
    ]);
    expect(
      extractRecords([
        story('123456', 1792070163, true),
        story('123456', 1792070163, false),
      ]),
    ).toEqual([{ videoId: '123456', publishTime: 1792070163, aiGenerated: false }]);
  });

  it('associates each streamed story with its own video, including deferred data', () => {
    const frames = new JsonFrames();
    const records = frames
      .push(streamedResponse)
      .flatMap((frame) => extractRecords(frame));
    expect(records).toEqual([
      { videoId: '5532624203628819', publishTime: 1792070163 },
      { videoId: '3720001698147023', publishTime: 1792357922 },
      { videoId: '5532624203628819', publishTime: 1792070163 },
    ]);
  });

  it('finds tracking in bootstrap JSON wrappers without evaluating scripts', () => {
    expect(
      extractRecords({
        require: [['Relay', [], [{ __bbox: { result: { data: story() } } }]]],
      }),
    ).toEqual([{ videoId: '5532624203628819', publishTime: 1792070163 }]);
  });

  it('never borrows timestamps or video IDs from unrelated siblings or comments', () => {
    const { tracking, attachments } = story();
    expect(extractRecords({ tracking, comments: [{ attachments }] })).toEqual([]);
    expect(extractRecords({ data: [{ tracking }, { attachments }] })).toEqual([]);
    expect(extractRecords({ attachments, creation_time: 1792070163 })).toEqual([]);
  });

  it('supports explicit video_id and rejects contradictory identifiers', () => {
    const { tracking } = story();
    expect(
      extractRecords({
        tracking,
        video_id: '123456',
        shareable_url: 'https://www.facebook.com/reel/123456',
      }),
    ).toEqual([{ videoId: '123456', publishTime: 1792070163 }]);
    expect(
      extractRecords({
        tracking,
        video_id: '123456',
        shareable_url: 'https://www.facebook.com/reel/654321',
      }),
    ).toEqual([]);
  });

  it('uses the media owner when page_insights contains conflicting owners', () => {
    const value = story();
    value.tracking = JSON.stringify({
      page_insights: {
        '90009': { post_context: { publish_time: 1700000000 } },
        '10001': { post_context: { publish_time: 1792070163 } },
      },
    });
    expect(extractRecords(value)).toEqual([
      { videoId: '5532624203628819', publishTime: 1792070163 },
    ]);
    expect(extractRecords({ tracking: value.tracking, video_id: '123456' })).toEqual([]);
  });

  it('ignores malformed tracking, milliseconds and imprecise numeric IDs', () => {
    expect(extractRecords({ ...story(), tracking: 'not JSON' })).toEqual([]);
    expect(extractRecords(story('123456', 1792070163000))).toEqual([]);
    expect(
      extractRecords({ tracking: story().tracking, video_id: 9007199254740994 }),
    ).toEqual([]);
    expect(
      extractRecords({
        ...story('123456'),
        tracking: '{"page_insights":{"10001":{"post_context":{"publish_time":NaN}}}}',
      }),
    ).toEqual([]);
  });

  it('does not assign a single timestamp to multiple attached videos', () => {
    const value = story();
    value.attachments.push(...story('123456').attachments);
    expect(extractRecords(value)).toEqual([]);
  });
});

describe('JSON framing', () => {
  it('handles arbitrary chunk boundaries, anti-XSSI, escaped quotes and multipart headers', () => {
    const frames = new JsonFrames();
    const text = `for (;;);\n${JSON.stringify({ data: story(), text: 'a"b\\c}😀' })}\r\n--boundary\r\nContent-Type: application/json\r\n\r\n${JSON.stringify([story('123456')])}\r\n--boundary--`;
    const output: unknown[] = [];
    for (let index = 0; index < text.length; index += 7)
      output.push(...frames.push(text.slice(index, index + 7)));
    expect(output.flatMap((frame) => extractRecords(frame))).toEqual([
      { videoId: '5532624203628819', publishTime: 1792070163 },
      { videoId: '123456', publishTime: 1792070163 },
    ]);
  });

  it('does not emit truncated or malformed JSON', () => {
    const truncated = new JsonFrames();
    expect(truncated.push('{"data":')).toEqual([]);
    expect(truncated.isComplete()).toBe(false);
    const malformed = new JsonFrames();
    expect(malformed.push('{invalid}')).toEqual([]);
    expect(malformed.isComplete()).toBe(false);
    const complete = new JsonFrames();
    complete.push('{"data":null}');
    expect(complete.isComplete()).toBe(true);
  });
});

describe('route and time', () => {
  it.each([
    ['https://www.facebook.com/reel/5532624203628819/?x=1', '5532624203628819'],
    ['https://www.facebook.com/reel/123456', '123456'],
    ['https://www.facebook.com/', null],
    ['https://www.facebook.com/reels/123456', null],
    ['https://www.facebook.com/reel/', null],
    ['https://m.facebook.com/reel/123456', null],
    ['https://www.facebook.com.evil.test/reel/123456', null],
    ['http://www.facebook.com/reel/123456', null],
    ['https://www.facebook.com/watch/?v=123456', null],
  ])('gates the exact URL %s', (url, expected) => {
    expect(getReelId(url)).toBe(expected);
  });
});

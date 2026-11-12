import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  window.dispatchEvent(new PageTransitionEvent('pagehide'));
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('keeps one controller across reinjection and resumes one subscription after page hiding', async () => {
  vi.useFakeTimers();
  const get = vi.fn().mockResolvedValue({ appearance: { showDate: false } });
  const addListener = vi.fn();
  const removeListener = vi.fn();
  vi.stubGlobal('chrome', {
    storage: { local: { get }, onChanged: { addListener, removeListener } },
  });
  const setInterval = vi.spyOn(window, 'setInterval');

  await import('../../src/content');
  await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(1));
  expect(addListener).toHaveBeenCalledTimes(1);
  expect(setInterval).toHaveBeenCalledTimes(1);

  vi.resetModules();
  await import('../../src/content');
  expect(get).toHaveBeenCalledTimes(1);
  expect(addListener).toHaveBeenCalledTimes(1);
  expect(setInterval).toHaveBeenCalledTimes(1);

  window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
  expect(removeListener).toHaveBeenCalledTimes(1);
  expect(removeListener).toHaveBeenCalledWith(addListener.mock.calls[0]![0]);
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  expect(get).toHaveBeenCalledTimes(2);
  expect(addListener).toHaveBeenCalledTimes(2);
  expect(setInterval).toHaveBeenCalledTimes(2);
});

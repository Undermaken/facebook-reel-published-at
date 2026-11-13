import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  window.dispatchEvent(new PageTransitionEvent('pagehide'));
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('replaces a stale controller without duplicate subscriptions or timers', async () => {
  vi.useFakeTimers();
  const get = vi.fn().mockResolvedValue({ appearance: { showDate: false } });
  const addListener = vi.fn();
  const removeListener = vi.fn();
  const addMessageListener = vi.fn();
  const removeMessageListener = vi.fn();
  vi.stubGlobal('chrome', {
    storage: { local: { get }, onChanged: { addListener, removeListener } },
    runtime: {
      id: 'test-extension',
      onMessage: {
        addListener: addMessageListener,
        removeListener: removeMessageListener,
      },
    },
  });
  const setInterval = vi.spyOn(window, 'setInterval');
  const clearInterval = vi.spyOn(window, 'clearInterval');

  await import('../../src/content');
  await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(1));
  expect(addListener).toHaveBeenCalledTimes(1);
  expect(setInterval).toHaveBeenCalledTimes(1);

  vi.resetModules();
  await import('../../src/content');
  expect(get).toHaveBeenCalledTimes(2);
  expect(addListener).toHaveBeenCalledTimes(2);
  expect(removeListener).toHaveBeenCalledTimes(1);
  expect(addMessageListener).toHaveBeenCalledTimes(2);
  expect(removeMessageListener).toHaveBeenCalledTimes(1);
  expect(setInterval).toHaveBeenCalledTimes(2);
  expect(clearInterval).toHaveBeenCalledTimes(1);

  window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
  expect(removeListener).toHaveBeenCalledTimes(2);
  expect(removeListener).toHaveBeenCalledWith(addListener.mock.calls[1]![0]);
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  expect(get).toHaveBeenCalledTimes(3);
  expect(addListener).toHaveBeenCalledTimes(3);
  expect(setInterval).toHaveBeenCalledTimes(3);
});

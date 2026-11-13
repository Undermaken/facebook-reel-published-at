import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  window.dispatchEvent(new PageTransitionEvent('pagehide'));
  window.history.replaceState({}, '', '/');
  vi.restoreAllMocks();
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

it('does not rescan a static Reel on each route poll', async () => {
  vi.useFakeTimers();
  window.history.replaceState({}, '', '/reel/5532624203628819/');
  vi.stubGlobal('chrome', {
    storage: {
      local: { get: vi.fn().mockResolvedValue({ appearance: { showDate: true } }) },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    runtime: {
      id: 'test-extension',
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  });
  vi.resetModules();
  const { DateView } = await import('../../src/view');
  const render = vi.spyOn(DateView.prototype, 'render');
  await import('../../src/content');
  await Promise.resolve();
  await Promise.resolve();
  vi.advanceTimersByTime(100);
  const initialRenders = render.mock.calls.length;
  expect(initialRenders).toBeGreaterThan(0);

  vi.advanceTimersByTime(1_500);

  expect(render).toHaveBeenCalledTimes(initialRenders);
});

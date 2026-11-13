import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { streamedResponse, story } from '../fixtures/stories';
import { pageHtml, viewer } from '../fixtures/viewer';

let context: BrowserContext;
let page: Page;
let html = '';
let response = '';

test.beforeEach(async () => {
  const extension = resolve('dist');
  html = pageHtml();
  response = streamedResponse;
  context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== 'https://www.facebook.com') return route.abort();
    if (url.pathname === '/api/graphql/')
      return route.fulfill({ contentType: 'application/json', body: response });
    if (route.request().isNavigationRequest())
      return route.fulfill({ contentType: 'text/html', body: html });
    return route.abort();
  });
  page = await context.newPage();
});

test.afterEach(async () => {
  await context.close();
});

test('reads bootstrap JSON and places one Italian date below the author', async () => {
  html = pageHtml(true);
  await page.goto('https://www.facebook.com/reel/5532624203628819/');
  const badge = page.locator('[data-fb-reel-date]');
  await expect(badge).toHaveCount(1);
  await expect(badge).toContainText('15 ottobre 2026');
  await expect(badge).toContainText('15:16:03');
  await expect(badge).not.toContainText('GMT');
  expect(await badge.evaluate((node) => node.previousElementSibling?.tagName)).toBe('H2');
  await page.screenshot({ path: test.info().outputPath('reel-date.png') });
});

test('logs a persistent missing date once without exposing GraphQL data', async () => {
  const warnings: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'warning' && message.text().includes('[Facebook Reel Date]'))
      warnings.push(message.text());
  });
  await page.goto('https://www.facebook.com/reel/5532624203628819/');
  await expect.poll(() => warnings.length, { timeout: 8_000 }).toBe(1);
  expect(warnings[0]).toContain('metadata_missing');
  expect(warnings[0]).not.toContain('publish_time');
  await page.evaluate(async () => {
    await fetch('/api/graphql/');
  });
  await expect(page.locator('[data-fb-reel-date]')).toContainText('15:16:03');
  expect(warnings).toHaveLength(1);
});

test('logs a failed GraphQL inspection without changing the page request', async () => {
  const warnings: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'warning' && message.text().includes('[Facebook Reel Date]'))
      warnings.push(message.text());
  });
  await page.goto('https://www.facebook.com/reel/5532624203628819/');
  const received = await page.evaluate(async () => {
    Response.prototype.clone = () => {
      throw new Error('test clone failure');
    };
    return (await fetch('/api/graphql/')).text();
  });
  expect(received).toBe(streamedResponse);
  await expect
    .poll(() =>
      warnings.some((warning) => warning.includes('response_inspection_failed')),
    )
    .toBe(true);
});

test('observes fetch without consuming or changing the response', async () => {
  await page.goto('https://www.facebook.com/reel/5532624203628819/');
  const received = await page.evaluate(async () =>
    (await fetch('/api/graphql/', { method: 'POST' })).text(),
  );
  expect(received).toBe(streamedResponse);
  await expect(page.locator('[data-fb-reel-date]')).toContainText('15:16:03');
  await page.evaluate(async () => {
    await fetch('/api/graphql/', { method: 'POST' });
  });
  await expect(page.locator('[data-fb-reel-date]')).toHaveCount(1);
});

test('validates network data under a CSP that forbids runtime code generation', async () => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      /eval|content security policy/i.test(message.text())
    )
      errors.push(message.text());
  });
  await page.route('https://www.facebook.com/reel/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      headers: { 'Content-Security-Policy': "script-src 'self'; object-src 'none'" },
      body: html,
    }),
  );
  await page.goto('https://www.facebook.com/reel/5532624203628819/');
  await page.evaluate(async () => {
    await fetch('/api/graphql/');
  });
  await expect(page.locator('[data-fb-reel-date]')).toContainText('15:16:03');
  expect(errors).toEqual([]);
});

test('observes both text and JSON XMLHttpRequest responses', async () => {
  await page.goto('https://www.facebook.com/reel/5532624203628819/');
  const received = await page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/graphql/');
        xhr.onload = () => resolve(xhr.responseText);
        xhr.onerror = reject;
        xhr.send();
      }),
  );
  expect(received).toBe(streamedResponse);
  await expect(page.locator('[data-fb-reel-date]')).toContainText('15:16:03');
  response = JSON.stringify({ data: story('123456', 1792357922) });
  await page.evaluate(
    (body) => {
      history.pushState({}, '', '/reel/123456/');
      document.body.innerHTML = body;
    },
    viewer('Secondo autore', 'second'),
  );
  const json = await page.evaluate(
    () =>
      new Promise<unknown>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/graphql/');
        xhr.responseType = 'json';
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = reject;
        xhr.send();
      }),
  );
  expect(json).toEqual(JSON.parse(response));
  await expect(page.locator('[data-fb-reel-date]')).toContainText('18 ottobre 2026');
});

test('activates on SPA entry, handles delayed DOM and removes the date on exit', async () => {
  html = pageHtml(false, '<main>Home</main>');
  await page.goto('https://www.facebook.com/');
  const originalFetch = await page.evaluateHandle(() => window.fetch);
  await page.evaluate(async () => {
    await fetch('/api/graphql/');
  });
  await expect(page.locator('[data-fb-reel-date]')).toHaveCount(0);
  await page.evaluate(() => history.pushState({}, '', '/reel/5532624203628819/'));
  await page.evaluate(async () => {
    await fetch('/api/graphql/');
  });
  await page.evaluate((body) => {
    document.body.innerHTML = body;
  }, viewer());
  await expect(page.locator('[data-fb-reel-date]')).toContainText('15:16:03');
  await page.evaluate(() => history.pushState({}, '', '/watch/'));
  await expect(page.locator('[data-fb-reel-date]')).toHaveCount(0);
  expect(
    await page.evaluate((original) => window.fetch === original, originalFetch),
  ).toBe(true);
});

test('does not attach a new Reel date to the previous player during transitions', async () => {
  await page.goto('https://www.facebook.com/reel/5532624203628819/');
  await page.evaluate(async () => {
    await fetch('/api/graphql/');
  });
  await expect(page.locator('[data-fb-reel-date]')).toContainText('15 ottobre 2026');
  await page.evaluate(() => history.pushState({}, '', '/reel/3720001698147023/'));
  await expect(page.locator('[data-fb-reel-date]')).toHaveCount(0);
  await page.evaluate(
    (body) => {
      document.body.innerHTML = body;
    },
    viewer('Altro autore', 'second'),
  );
  await expect(page.locator('[data-fb-reel-date]')).toContainText('18 ottobre 2026');
  await expect(page.locator('[data-fb-reel-date]')).toHaveCount(1);
});

test('ignores links to suggested Reels beside the active player', async () => {
  html = pageHtml(
    true,
    viewer().replace(
      '<p>Descrizione del Reel</p>',
      '<p>Descrizione del Reel</p><a href="/reel/999123456/">Suggested Reel</a>',
    ),
  );
  await page.goto('https://www.facebook.com/reel/5532624203628819/');
  await expect(page.locator('[data-fb-reel-date]')).toContainText('15:16:03');
});

test('rejects a video directly linked to another Reel', async () => {
  html = pageHtml(
    true,
    viewer()
      .replace('<video playsinline', '<a href="/reel/999123456/"><video playsinline')
      .replace('</video>', '</video></a>'),
  );
  await page.goto('https://www.facebook.com/reel/5532624203628819/');
  await expect(page.locator('[data-fb-reel-date]')).toHaveCount(0);
});

test('ignores non-GraphQL traffic and malformed bridge payloads', async () => {
  await page.goto('https://www.facebook.com/reel/5532624203628819/');
  await page.evaluate(() => {
    window.postMessage(
      {
        channel: 'facebook-reel-date/v1',
        type: 'records',
        records: [
          { videoId: '5532624203628819', publishTime: '<img src=x onerror=alert(1)>' },
        ],
      },
      location.origin,
    );
    window.postMessage(
      {
        channel: 'facebook-reel-date/v1',
        type: 'records',
        records: [{ videoId: '<b>bad</b>', publishTime: 1792070163 }],
      },
      location.origin,
    );
  });
  await expect(page.locator('[data-fb-reel-date]')).toHaveCount(0);
  await page.evaluate(async () => {
    await fetch('/api/graphql/');
  });
  await expect(page.locator('[data-fb-reel-date]')).toContainText('15:16:03');
});

test('binds the previous player even when its publication date is missing', async () => {
  response = JSON.stringify({ data: story('3720001698147023', 1792357922) });
  await page.goto('https://www.facebook.com/reel/5532624203628819/');
  await page.evaluate(async () => {
    await fetch('/api/graphql/');
  });
  // Let both the delayed scan and the route poll observe the undated player.
  await page.waitForTimeout(600);
  await page.evaluate(() => history.pushState({}, '', '/reel/3720001698147023/'));
  await page.waitForTimeout(600);
  await expect(page.locator('[data-fb-reel-date]')).toHaveCount(0);
  await page.evaluate(
    (body) => {
      document.body.innerHTML = body;
    },
    viewer('Nuovo autore', 'new'),
  );
  await expect(page.locator('[data-fb-reel-date]')).toContainText('18 ottobre 2026');
});

test('opening and abandoning XHRs does not prevent subsequent observation', async () => {
  await page.goto('https://www.facebook.com/reel/5532624203628819/');
  const received = await page.evaluate(() => {
    for (let i = 0; i < 20; i++) {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/graphql/');
      xhr.abort();
    }
    return new Promise<string>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/graphql/');
      xhr.onload = () => resolve(xhr.responseText);
      xhr.send();
    });
  });
  expect(received).toBe(streamedResponse);
  await expect(page.locator('[data-fb-reel-date]')).toContainText('15:16:03');
});

test('fetch inspection never adds synchronous exceptions for native-coercible inputs', async () => {
  await page.goto('https://www.facebook.com/reel/5532624203628819/');
  const result = await page.evaluate(() => {
    try {
      const promise = fetch(null as unknown as string);
      void promise.catch(() => {});
      return promise instanceof Promise;
    } catch {
      return false;
    }
  });
  expect(result).toBe(true);
});

test('reads bootstrap scripts when their text is populated after the first scan', async () => {
  html = pageHtml(
    false,
    `${viewer()}<script id="late-data" type="application/json">{"pending":true}</script>`,
  );
  await page.goto('https://www.facebook.com/reel/5532624203628819/');
  await page.waitForTimeout(600);
  await page.evaluate(
    (value) => {
      document.querySelector('#late-data')!.textContent = value;
    },
    JSON.stringify({ data: story() }),
  );
  await expect(page.locator('[data-fb-reel-date]')).toContainText('15:16:03');
});

test('restores native hooks when Facebook bypasses the wrapped history methods', async () => {
  await page.goto('https://www.facebook.com/');
  const originalFetch = await page.evaluateHandle(() => window.fetch);
  await page.evaluate(() => history.pushState({}, '', '/reel/5532624203628819/'));
  await page.evaluate(async () => {
    await fetch('/api/graphql/');
  });
  await expect(page.locator('[data-fb-reel-date]')).toContainText('15:16:03');
  await page.evaluate(() => History.prototype.pushState.call(history, {}, '', '/watch/'));
  await expect(page.locator('[data-fb-reel-date]')).toHaveCount(0);
  await expect
    .poll(() => page.evaluate((original) => window.fetch === original, originalFetch))
    .toBe(true);
});

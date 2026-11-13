import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { pageHtml, viewer } from '../fixtures/viewer';
import { story } from '../fixtures/stories';

let context: BrowserContext;
let page: Page;
let origin: string;

async function openExtension(
  locale = 'it-IT',
  timezoneId = 'Europe/Rome',
  publication = story(),
) {
  const extension = resolve('dist');
  context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    locale,
    timezoneId,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  await context.route('https://**/*', (route) => {
    if (
      route.request().isNavigationRequest() &&
      new URL(route.request().url()).origin === 'https://www.facebook.com'
    )
      return route.fulfill({
        contentType: 'text/html',
        body: pageHtml(true, viewer(), publication),
      });
    return route.abort();
  });
  page = await context.newPage();
  const session = await context.newCDPSession(page);
  const extensionOrigin = new Promise<string>((resolve) => {
    session.on('Runtime.executionContextCreated', (event) => {
      if (event.context.origin.startsWith('chrome-extension://'))
        resolve(event.context.origin);
    });
  });
  await session.send('Runtime.enable');
  await page.goto('https://www.facebook.com/reel/5532624203628819/');
  origin = await extensionOrigin;
  await session.detach();
}

async function openPopup() {
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 510, height: 600 });
  await popup.goto(`${origin}/popup.html`);
  return popup;
}

test.afterEach(async () => {
  await context?.close();
});

test('the interactive popup saves appearance and relative age across openings', async () => {
  await openExtension();
  let popup = await openPopup();
  await expect(popup.locator('h1')).toHaveText('Date dei Reel');
  await popup.locator('#text-color').fill('#ffcc00');
  await popup.locator('#background-color').fill('#123456');
  await popup.locator('#border-color').fill('#e57936');
  await popup.locator('#font-size').fill('18');
  await popup.locator('#show-relative').check();
  const label = page.locator('[data-fb-reel-date] .label');
  await expect(label).toHaveCSS('color', 'rgb(255, 204, 0)');
  await expect(label).toHaveCSS('background-color', 'rgb(18, 52, 86)');
  await expect(label).toHaveCSS('border-color', 'rgb(229, 121, 54)');
  await expect(label).toHaveCSS('font-size', '18px');
  await expect(page.locator('[data-fb-reel-date] [data-relative]')).toBeVisible();
  await popup.screenshot({ path: test.info().outputPath('settings-it.png') });
  await popup.locator('[data-position="top"]').click();
  await expect
    .poll(() => popup.evaluate(() => chrome.storage.local.get('appearance')))
    .toEqual({
      appearance: {
        position: 'top',
        textColor: '#ffcc00',
        fontSize: 18,
        backgroundColor: '#123456',
        borderColor: '#e57936',
        showRelative: true,
        showAiBadge: false,
        showDate: true,
      },
    });
  await popup.close();
  popup = await openPopup();
  await expect(popup.locator('#text-color')).toHaveValue('#ffcc00');
  await expect(popup.locator('#font-size')).toHaveValue('18');
  await expect(popup.locator('#background-color')).toHaveValue('#123456');
  await expect(popup.locator('#border-color')).toHaveValue('#e57936');
  await expect(popup.locator('[data-position="top"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(popup.locator('#show-relative')).toBeChecked();
});

test('places the date at the top or outside the bottom and restores the player', async () => {
  await openExtension();
  const popup = await openPopup();
  const video = page.locator('.player video');
  const before = (await video.boundingBox())!;
  await popup.locator('[data-position="top"]').click();
  const badge = page.locator('[data-fb-reel-date]');
  await expect(badge).toHaveAttribute('data-position', 'top');
  let rect = (await badge.boundingBox())!;
  expect(Math.abs(rect.x + rect.width / 2 - before.x - before.width / 2)).toBeLessThan(2);
  expect(rect.y).toBeGreaterThanOrEqual(before.y);
  expect(rect.y).toBeLessThan(before.y + 25);
  await page.screenshot({ path: test.info().outputPath('position-top.png') });
  await popup.locator('#font-size').fill('24');
  await popup.locator('#show-relative').check();
  await popup.locator('[data-position="bottom"]').click();
  await expect(badge).toHaveAttribute('data-position', 'bottom');
  await expect
    .poll(async () => {
      const frame = (await video.boundingBox())!;
      const label = (await badge.boundingBox())!;
      return label.y >= frame.y + frame.height + 6 && label.y + label.height <= 714;
    })
    .toBe(true);
  rect = (await video.boundingBox())!;
  expect(rect.height).toBeLessThan(before.height);
  await page.screenshot({ path: test.info().outputPath('position-bottom.png') });
  await popup.locator('[data-position="author"]').click();
  await expect(badge).toHaveAttribute('data-position', 'author');
  expect(await badge.evaluate((node) => node.previousElementSibling?.tagName)).toBe('H2');
  expect((await video.boundingBox())!.height).toBeCloseTo(before.height, 0);
  await popup.locator('[data-position="bottom"]').click();
  await expect(badge).toHaveAttribute('data-position', 'bottom');
  await page.evaluate(() => history.pushState({}, '', '/watch/'));
  await expect(badge).toHaveCount(0);
  expect((await video.boundingBox())!.height).toBeCloseTo(before.height, 0);
});

test('moves the label in a tab that stayed open while the extension restarted', async () => {
  await openExtension();
  const badge = page.locator('[data-fb-reel-date]');
  await expect(badge).toHaveAttribute('data-position', 'author');
  const extensionsPage = await context.newPage();
  await extensionsPage.goto('chrome://extensions/');
  const item = extensionsPage.locator('extensions-item');
  const toggle = item.locator('#enableToggle');
  await toggle.click();
  await expect(item.locator('#card')).toHaveClass('disabled');
  await toggle.click();
  await expect(item.locator('#card')).toHaveClass('enabled');
  const popup = await openPopup();
  await popup.locator('[data-position="top"]').click();
  await expect
    .poll(() => popup.evaluate(() => chrome.storage.local.get('appearance')))
    .toMatchObject({ appearance: { position: 'top' } });
  await expect(badge).toHaveAttribute('data-position', 'top');
  await page.waitForTimeout(650);
  await expect(badge).toHaveCount(1);
  await expect(badge).toHaveAttribute('data-position', 'top');
  await popup.locator('[data-position="bottom"]').click();
  await expect(badge).toHaveAttribute('data-position', 'bottom');
  await page.route('https://www.facebook.com/api/graphql/', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: story('123456') }),
    }),
  );
  await page.evaluate(
    (body) => {
      history.pushState({}, '', '/reel/123456/');
      document.body.innerHTML = body;
    },
    viewer('Next author', 'next'),
  );
  await page.evaluate(async () => {
    await (await fetch('/api/graphql/')).text();
  });
  await expect(badge).toContainText('15 ottobre 2026');
  await expect(badge).toHaveAttribute('data-position', 'bottom');
  await expect(badge).toHaveCount(1);
});

test('keeps bottom placement stable beside a smaller visible Reel', async () => {
  await openExtension('fr-FR');
  await page.evaluate(() => {
    const neighbor = document.createElement('section');
    neighbor.style.cssText = 'position:fixed;left:0;top:12px;width:300px;height:400px;';
    neighbor.innerHTML =
      '<video></video><h2><a href="/profile.php?id=10002">Second author</a></h2>';
    document.querySelector('[role="main"]')!.append(neighbor);
  });
  const popup = await openPopup();
  await popup.locator('#font-size').fill('24');
  await popup.locator('#show-relative').check();
  await popup.locator('[data-position="bottom"]').click();
  await expect(page.locator('[data-fb-reel-date]')).toHaveAttribute(
    'data-position',
    'bottom',
  );
  const samples = await page.evaluate(async () => {
    const results: { badges: number; height: number }[] = [];
    for (let index = 0; index < 10; index++) {
      window.dispatchEvent(new Event('resize'));
      await new Promise((resolve) => setTimeout(resolve, 120));
      results.push({
        badges: document.querySelectorAll('[data-fb-reel-date]').length,
        height: document.querySelector('video')!.getBoundingClientRect().height,
      });
    }
    return results;
  });
  for (const sample of samples) {
    expect(sample.badges).toBe(1);
    expect(sample.height).toBeCloseTo(samples[0]!.height, 1);
    expect(sample.height).toBeLessThan(680);
  }
});

for (const [locale, title, prefix, aiLabel, missingLabel] of [
  ['it-IT', 'Date dei Reel', 'Pubblicato il', 'AI · Facebook', 'Data creazione assente'],
  ['en-GB', 'Reel dates', 'Published on', 'AI · Facebook', 'Creation date unavailable'],
  [
    'es-ES',
    'Fechas de Reels',
    'Publicado el',
    'IA · Facebook',
    'Fecha de creación no disponible',
  ],
  [
    'de-DE',
    'Reel-Datum',
    'Veröffentlicht am',
    'KI · Facebook',
    'Erstellungsdatum nicht verfügbar',
  ],
  [
    'fr-FR',
    'Dates des Reels',
    'Publié le',
    'IA · Facebook',
    'Date de création indisponible',
  ],
  ['pt-BR', 'Reel dates', 'Published on', 'AI · Facebook', 'Creation date unavailable'],
]) {
  test(`localizes the popup and Reel for ${locale}`, async () => {
    await openExtension(
      locale,
      'Europe/Rome',
      story('5532624203628819', 1792070163, true),
    );
    const popup = await openPopup();
    await expect(popup.locator('h1')).toHaveText(title!);
    await expect(page.locator('[data-fb-reel-date]')).toContainText(prefix!);
    await expect(page.locator('[data-fb-reel-date]')).not.toContainText('GMT');
    await expect(popup.locator('[data-i18n="relative"]')).not.toBeEmpty();
    await expect(popup.locator('#show-date')).toBeChecked();
    await expect(popup.locator('#show-ai-badge')).not.toBeChecked();
    await expect(page.locator('[data-ai]')).toHaveCount(0);
    await popup.locator('#show-ai-badge').check();
    await expect(page.locator('[data-ai]')).toHaveText(aiLabel!);
    await expect(popup.locator('[data-ai]')).toHaveText(aiLabel!);
    await popup.screenshot({ path: test.info().outputPath(`ai-settings-${locale}.png`) });
    const missing = story('123456', 1792070163, false);
    missing.tracking = JSON.stringify({
      page_insights: { '10001': { post_context: { publish_time: null } } },
    });
    await page.evaluate(
      ({ body, data }) => {
        history.pushState({}, '', '/reel/123456/');
        document.body.innerHTML = body;
        const script = document.createElement('script');
        script.type = 'application/json';
        script.textContent = JSON.stringify({ data });
        document.body.append(script);
      },
      { body: viewer('Second author', 'second'), data: missing },
    );
    await expect(page.locator('[data-missing-date]')).toHaveText(missingLabel!);
    await expect(page.locator('[data-ai]')).toHaveCount(0);
  });
}

test('disabling dates suspends the display and network observation until re-enabled', async () => {
  await openExtension(
    'it-IT',
    'Europe/Rome',
    story('5532624203628819', 1792070163, true),
  );
  let popup = await openPopup();
  await popup.locator('#show-ai-badge').check();
  await popup.locator('[data-position="bottom"]').click();
  await expect(page.locator('[data-ai]')).toBeVisible();
  await popup.locator('#show-date').uncheck();
  await expect(page.locator('[data-fb-reel-date]')).toHaveCount(0);
  await expect(popup.locator('time')).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        [
          window.fetch,
          XMLHttpRequest.prototype.open,
          XMLHttpRequest.prototype.send,
        ].every((fn) => Function.prototype.toString.call(fn).includes('[native code]')),
      ),
    )
    .toBe(true);
  expect((await page.locator('video').first().boundingBox())!.height).toBeCloseTo(680, 0);
  await popup.close();
  popup = await openPopup();
  await expect(popup.locator('#show-date')).not.toBeChecked();
  await expect(popup.locator('#show-ai-badge')).toBeChecked();
  await page.reload();
  await page.waitForTimeout(600);
  await expect(page.locator('[data-fb-reel-date]')).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      Function.prototype.toString.call(window.fetch).includes('[native code]'),
    ),
  ).toBe(true);
  await popup.locator('#show-date').check();
  await expect(page.locator('[data-ai]')).toBeVisible();
  await expect(page.locator('[data-fb-reel-date]')).toContainText('15 ottobre 2026');
});

test('waits for a complete response before confirming absence, then replaces it with a late date', async () => {
  await openExtension();
  const popup = await openPopup();
  await popup.locator('#show-ai-badge').check();
  await popup.locator('#show-relative').check();
  await popup.locator('#show-date').uncheck();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Function.prototype.toString.call(window.fetch).includes('[native code]'),
      ),
    )
    .toBe(true);
  await page.evaluate(
    (body) => {
      history.pushState({}, '', '/reel/123456/');
      document.body.innerHTML = body;
      window.fetch = async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              (
                window as unknown as {
                  testStream: ReadableStreamDefaultController<Uint8Array>;
                }
              ).testStream = controller;
            },
          }),
        );
    },
    viewer('Undated author', 'undated'),
  );
  await popup.locator('#show-date').check();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Function.prototype.toString.call(window.fetch).includes('Reflect.apply'),
      ),
    )
    .toBe(true);
  await page.evaluate(() => {
    void fetch('/api/graphql/').then((response) => response.text());
  });
  const missing = story('123456', 1792070163, true);
  missing.tracking = JSON.stringify({
    page_insights: { '10001': { post_context: { publish_time: null } } },
  });
  await page.evaluate((data) => {
    (
      window as unknown as { testStream: ReadableStreamDefaultController<Uint8Array> }
    ).testStream.enqueue(
      new TextEncoder().encode(
        JSON.stringify({ data, extensions: { is_final: false } }) + '\n',
      ),
    );
  }, missing);
  await page.waitForTimeout(650);
  await expect(page.locator('[data-fb-reel-date]')).toHaveCount(0);
  await page.evaluate(() => {
    const controller = (
      window as unknown as { testStream: ReadableStreamDefaultController<Uint8Array> }
    ).testStream;
    controller.enqueue(new TextEncoder().encode('{"extensions":{"is_final":true}}\n'));
    controller.close();
  });
  await expect(page.locator('[data-missing-date]')).toHaveText('Data creazione assente');
  await expect(page.locator('[data-ai]')).toBeVisible();
  await expect(page.locator('[data-relative]')).toHaveCount(0);
  await page.evaluate((data) => {
    const script = document.createElement('script');
    script.type = 'application/json';
    script.textContent = JSON.stringify({ data });
    document.body.append(script);
  }, story('123456'));
  await expect(page.locator('[data-fb-reel-date]')).toContainText('15 ottobre 2026');
  await expect(page.locator('[data-missing-date]')).toHaveCount(0);
  await expect(page.locator('[data-relative]')).toBeVisible();
});

for (const failure of [
  'unfinished stream',
  'array-wrapped stream',
  'truncated frame',
  'GraphQL errors',
  'HTTP failure',
]) {
  test(`never infers an absent date from ${failure}`, async () => {
    await openExtension();
    const popup = await openPopup();
    await page.route('https://www.facebook.com/api/graphql/', (route) => {
      const envelope = {
        data: {
          ...story('123456'),
          tracking: JSON.stringify({
            page_insights: { '10001': { post_context: { publish_time: null } } },
          }),
        },
        extensions: { is_final: !failure.includes('stream') },
        ...(failure === 'GraphQL errors'
          ? { errors: [{ message: 'Partial response' }] }
          : {}),
      };
      return route.fulfill({
        status: failure === 'HTTP failure' ? 500 : 200,
        contentType: 'application/json',
        body:
          JSON.stringify(failure === 'array-wrapped stream' ? [envelope] : envelope) +
          (failure === 'truncated frame' ? '\n{"data":' : ''),
      });
    });
    await page.evaluate(
      (body) => {
        history.pushState({}, '', '/reel/123456/');
        document.body.innerHTML = body;
      },
      viewer('Loading author', 'loading'),
    );
    await page.evaluate(async () => {
      await (await fetch('/api/graphql/')).text();
    });
    await page.waitForTimeout(650);
    await expect(page.locator('[data-fb-reel-date]')).toHaveCount(0);
    await expect(popup.locator('#show-date')).toBeChecked();
  });
}

test('retains network-only metadata when the display is paused and resumed', async () => {
  await openExtension();
  const popup = await openPopup();
  let requests = 0;
  await page.route('https://www.facebook.com/api/graphql/', (route) => {
    requests++;
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: story('123456') }),
    });
  });
  await page.evaluate(
    (body) => {
      history.pushState({}, '', '/reel/123456/');
      document.body.innerHTML = body;
    },
    viewer('Network author', 'network'),
  );
  await page.evaluate(async () => {
    await (await fetch('/api/graphql/')).text();
  });
  await expect(page.locator('[data-fb-reel-date]')).toContainText('15 ottobre 2026');
  await popup.locator('#show-date').uncheck();
  await expect(page.locator('[data-fb-reel-date]')).toHaveCount(0);
  await popup.locator('#show-date').check();
  await expect(page.locator('[data-fb-reel-date]')).toContainText('15 ottobre 2026');
  expect(requests).toBe(1);
});

test('uses the browser timezone rather than forcing Italian time', async () => {
  await openExtension('en-US', 'America/New_York');
  await expect(page.locator('[data-fb-reel-date]')).toContainText('9:16:03 AM');
  await expect(page.locator('[data-fb-reel-date]')).not.toContainText('15:16:03');
  await expect(page.locator('[data-fb-reel-date] time')).not.toHaveAttribute(
    'title',
    /GMT|UTC/,
  );
});

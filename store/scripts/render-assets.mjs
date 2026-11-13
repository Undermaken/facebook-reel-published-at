import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const storeRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = resolve(storeRoot, '..');
const assetRoot = join(storeRoot, 'assets');
const extensionRoot = join(projectRoot, 'dist');
const iconData =
  'data:image/png;base64,' +
  (await readFile(join(projectRoot, 'icons/icon-128.png'))).toString('base64');
const popupSource = await readFile(join(projectRoot, 'popup.html'), 'utf8');
const sceneSvg = popupSource.match(/<svg viewBox="0 0 180 320"[\s\S]*?<\/svg>/)?.[0];
if (!sceneSvg) throw new Error('The original Reel illustration was not found.');
const sceneData = 'data:image/svg+xml;base64,' + Buffer.from(sceneSvg).toString('base64');
const [demoTemplate, settingsTemplate, promoTemplate] = await Promise.all([
  readFile(join(storeRoot, 'templates/demo.html'), 'utf8'),
  readFile(join(storeRoot, 'templates/settings.html'), 'utf8'),
  readFile(join(storeRoot, 'templates/promo.html'), 'utf8'),
]);

const locales = {
  en: {
    browser: 'en-GB',
    title: 'See when it was published',
    subtitle: 'The publication date appears beside the Reel you are watching.',
    note: 'Illustrative Reel · Date label rendered by the extension',
    author: 'Example creator',
    follow: 'Follow',
    description: 'Example Reel',
    settingsTitle: 'Choose the position',
    settingsSubtitle:
      'Set the colors, text size, and optional details in the extension popup.',
    settingsNote: 'Actual extension settings · Illustrative Reel in the preview',
    bottomTitle: 'Move it below the Reel',
    bottomSubtitle: 'Switch positions in settings without refreshing the page.',
  },
  it: {
    browser: 'it-IT',
    title: 'Scopri quando è stato pubblicato',
    subtitle: 'La data di pubblicazione compare accanto al Reel che stai guardando.',
    note: "Reel illustrativo · Box della data creato dall'estensione",
    author: 'Autore di esempio',
    follow: 'Segui',
    description: 'Reel di esempio',
    settingsTitle: 'Scegli la posizione',
    settingsSubtitle:
      'Imposta colori, dimensione del testo e dettagli opzionali nel pannello.',
    settingsNote: "Pannello reale dell'estensione · Reel illustrativo nell'anteprima",
    bottomTitle: 'Spostala sotto il Reel',
    bottomSubtitle: 'Cambia posizione nelle impostazioni senza ricaricare la pagina.',
  },
  es: {
    browser: 'es-ES',
    title: 'Descubre cuándo se publicó',
    subtitle: 'La fecha de publicación aparece junto al Reel que estás viendo.',
    note: 'Reel ilustrativo · Fecha mostrada por la extensión',
    author: 'Autor de ejemplo',
    follow: 'Seguir',
    description: 'Reel de ejemplo',
    settingsTitle: 'Elige la posición',
    settingsSubtitle:
      'Ajusta colores, tamaño del texto y detalles opcionales en el panel.',
    settingsNote: 'Panel real de la extensión · Reel ilustrativo en la vista previa',
    bottomTitle: 'Colócala bajo el Reel',
    bottomSubtitle: 'Cambia la posición sin recargar la página.',
  },
  de: {
    browser: 'de-DE',
    title: 'Sieh, wann es veröffentlicht wurde',
    subtitle: 'Das Veröffentlichungsdatum erscheint direkt beim geöffneten Reel.',
    note: 'Illustratives Reel · Datumsanzeige der Erweiterung',
    author: 'Beispiel-Ersteller',
    follow: 'Folgen',
    description: 'Beispiel-Reel',
    settingsTitle: 'Wähle die Position',
    settingsSubtitle: 'Stelle Farben, Schriftgröße und optionale Angaben im Menü ein.',
    settingsNote: 'Echte Erweiterungseinstellungen · Illustratives Reel in der Vorschau',
    bottomTitle: 'Unter dem Reel anzeigen',
    bottomSubtitle: 'Ändere die Position ohne Neuladen der Seite.',
  },
  fr: {
    browser: 'fr-FR',
    title: 'Voyez quand il a été publié',
    subtitle: 'La date de publication apparaît à côté du Reel consulté.',
    note: "Reel illustratif · Date affichée par l'extension",
    author: "Auteur d'exemple",
    follow: "S'abonner",
    description: "Reel d'exemple",
    settingsTitle: 'Choisissez la position',
    settingsSubtitle:
      'Réglez les couleurs, la taille du texte et les options dans le panneau.',
    settingsNote: "Vrai panneau de l'extension · Reel illustratif dans l'aperçu",
    bottomTitle: 'Placez-la sous le Reel',
    bottomSubtitle: 'Changez la position sans recharger la page.',
  },
};

function fill(template, values) {
  return Object.entries(values).reduce(
    (html, [key, value]) => html.replaceAll('{{' + key + '}}', String(value)),
    template,
  );
}

function makeStory() {
  const videoId = '5532624203628819';
  return {
    data: {
      __typename: 'Story',
      tracking: JSON.stringify({
        page_insights: {
          10001: { post_context: { publish_time: 1792070163, object_fbtype: 266 } },
        },
      }),
      attachments: [
        {
          media: {
            __typename: 'Video',
            id: videoId,
            shareable_url: 'https://www.facebook.com/reel/' + videoId,
            owner: { id: '10001' },
          },
        },
      ],
    },
  };
}

async function screenshotHtml(context, html, path, width = 1280, height = 800) {
  const page = await context.newPage();
  await page.setViewportSize({ width, height });
  await page.setContent(html);
  await page.evaluate(async () => {
    await Promise.all(Array.from(document.images, (image) => image.decode()));
    await new Promise((resolveFrame) => requestAnimationFrame(resolveFrame));
    await new Promise((resolveFrame) => requestAnimationFrame(resolveFrame));
  });
  await page.screenshot({ path });
  await page.close();
}

await mkdir(assetRoot, { recursive: true });
for (const [locale, copy] of Object.entries(locales)) {
  const output = join(assetRoot, locale);
  await mkdir(output, { recursive: true });
  const demoHtml = fill(demoTemplate, {
    LANG: locale,
    ICON_DATA: iconData,
    SCENE_DATA: sceneData,
    STORY_JSON: JSON.stringify(makeStory()),
    TITLE: copy.title,
    SUBTITLE: copy.subtitle,
    NOTE: copy.note,
    AUTHOR: copy.author,
    FOLLOW: copy.follow,
    DESCRIPTION: copy.description,
  });
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    locale: copy.browser,
    timezoneId: 'Europe/Rome',
    viewport: { width: 1280, height: 800 },
    args: [
      '--disable-extensions-except=' + extensionRoot,
      '--load-extension=' + extensionRoot,
    ],
  });
  try {
    await context.route('https://**/*', (route) => {
      const requestUrl = new URL(route.request().url());
      if (
        route.request().isNavigationRequest() &&
        requestUrl.origin === 'https://www.facebook.com' &&
        requestUrl.pathname === '/reel/5532624203628819/'
      ) {
        return route.fulfill({ contentType: 'text/html', body: demoHtml });
      }
      return route.abort();
    });
    const reel = await context.newPage();
    const session = await context.newCDPSession(reel);
    const extensionOrigin = new Promise((resolveOrigin) => {
      session.on('Runtime.executionContextCreated', (event) => {
        if (event.context.origin.startsWith('chrome-extension://')) {
          resolveOrigin(event.context.origin);
        }
      });
    });
    await session.send('Runtime.enable');
    await reel.goto('https://www.facebook.com/reel/5532624203628819/');
    const origin = await extensionOrigin;
    await session.detach();
    const badge = reel.locator('[data-fb-reel-date]');
    await badge.waitFor({ state: 'visible', timeout: 10000 });
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 510, height: 600 });
    await popup.goto(origin + '/popup.html');
    await popup.locator('#font-size').fill('20');
    await reel.waitForFunction(() => {
      const label = document
        .querySelector('[data-fb-reel-date]')
        ?.shadowRoot?.querySelector('.label');
      return label && getComputedStyle(label).fontSize === '20px';
    });
    await reel.screenshot({ path: join(output, '01-date-on-reel.png') });

    await popup.locator('[data-position="top"]').click();
    await popup.locator('#show-relative').check();
    await reel.waitForFunction(
      () =>
        document.querySelector('[data-fb-reel-date]')?.getAttribute('data-position') ===
        'top',
    );
    const popupPng = await popup.screenshot();
    const settingsHtml = fill(settingsTemplate, {
      LANG: locale,
      ICON_DATA: iconData,
      POPUP_DATA: 'data:image/png;base64,' + popupPng.toString('base64'),
      TITLE: copy.settingsTitle,
      SUBTITLE: copy.settingsSubtitle,
      NOTE: copy.settingsNote,
    });
    await screenshotHtml(context, settingsHtml, join(output, '02-settings.png'));

    await popup.locator('#show-relative').uncheck();
    await popup.locator('[data-position="bottom"]').click();
    await reel.waitForFunction(
      () =>
        document.querySelector('[data-fb-reel-date]')?.getAttribute('data-position') ===
        'bottom',
    );
    await reel.evaluate(
      ({ title, subtitle }) => {
        document.querySelector('.copy h1').textContent = title;
        document.querySelector('.copy p').textContent = subtitle;
      },
      { title: copy.bottomTitle, subtitle: copy.bottomSubtitle },
    );
    await reel.screenshot({ path: join(output, '03-below-reel.png') });
    await popup.close();
    await reel.close();
    process.stdout.write('Rendered ' + locale + ' screenshots\n');
  } finally {
    await context.close();
  }
}

for (const [name, layout] of Object.entries({
  'promo-small-440x280.png': {
    WIDTH: 440,
    HEIGHT: 280,
    ARC_SIZE: 260,
    ARC_LEFT: 3,
    ARC_TOP: 10,
    ARC_BORDER: 2,
    ICON_SIZE: 128,
    ICON_LEFT: 54,
    ICON_TOP: 76,
    LINE_LEFT: 184,
    LINE_TOP: 140,
    LINE_WIDTH: 77,
    LINE_HEIGHT: 4,
    DOT_SIZE: 10,
    REEL_RIGHT: 37,
    REEL_TOP: 20,
    REEL_WIDTH: 126,
    REEL_HEIGHT: 240,
    REEL_RADIUS: 18,
    CHIP_FONT: 14,
  },
  'promo-marquee-1400x560.png': {
    WIDTH: 1400,
    HEIGHT: 560,
    ARC_SIZE: 600,
    ARC_LEFT: 60,
    ARC_TOP: -20,
    ARC_BORDER: 4,
    ICON_SIZE: 262,
    ICON_LEFT: 270,
    ICON_TOP: 149,
    LINE_LEFT: 550,
    LINE_TOP: 279,
    LINE_WIDTH: 326,
    LINE_HEIGHT: 7,
    DOT_SIZE: 18,
    REEL_RIGHT: 175,
    REEL_TOP: 28,
    REEL_WIDTH: 290,
    REEL_HEIGHT: 504,
    REEL_RADIUS: 29,
    CHIP_FONT: 26,
  },
})) {
  const browser = await chromium.launch({ channel: 'chromium', headless: true });
  try {
    const context = await browser.newContext();
    const html = fill(promoTemplate, {
      ...layout,
      ICON_DATA: iconData,
      SCENE_DATA: sceneData,
    });
    await screenshotHtml(
      context,
      html,
      join(assetRoot, name),
      layout.WIDTH,
      layout.HEIGHT,
    );
    await context.close();
  } finally {
    await browser.close();
  }
}

const iconBrowser = await chromium.launch({ channel: 'chromium', headless: true });
try {
  const context = await iconBrowser.newContext();
  const iconPage = await context.newPage();
  await iconPage.setViewportSize({ width: 128, height: 128 });
  await iconPage.setContent(
    '<body style="margin:0;display:grid;place-items:center;width:128px;height:128px">' +
      '<img src="' +
      iconData +
      '" width="96" height="96" alt=""></body>',
  );
  await iconPage.screenshot({
    path: join(assetRoot, 'store-icon-128.png'),
    omitBackground: true,
  });
  await context.close();
} finally {
  await iconBrowser.close();
}

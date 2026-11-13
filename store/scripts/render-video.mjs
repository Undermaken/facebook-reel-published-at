import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const run = promisify(execFile);
const storeRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assetRoot = join(storeRoot, 'assets');
const videoRoot = join(storeRoot, 'video');
const captions = {
  en: [
    'Publication date and time beside the Reel.',
    'Choose the position, colors, and optional details.',
    'Changes appear without reloading the page.',
  ],
  it: [
    'Data e ora di pubblicazione accanto al Reel.',
    'Scegli posizione, colori e dettagli opzionali.',
    'Le modifiche appaiono senza ricaricare la pagina.',
  ],
  es: [
    'Fecha y hora de publicación junto al Reel.',
    'Elige posición, colores y detalles opcionales.',
    'Los cambios aparecen sin recargar la página.',
  ],
  de: [
    'Veröffentlichungsdatum und Uhrzeit beim Reel.',
    'Wähle Position, Farben und optionale Angaben.',
    'Änderungen erscheinen ohne Neuladen der Seite.',
  ],
  fr: [
    'Date et heure de publication à côté du Reel.',
    'Choisissez la position, les couleurs et les options.',
    'Les modifications apparaissent sans recharger la page.',
  ],
};
const intervals = [
  ['00:00:00,000', '00:00:05,500'],
  ['00:00:05,500', '00:00:11,000'],
  ['00:00:11,000', '00:00:17,000'],
];

await mkdir(videoRoot, { recursive: true });
for (const [locale, lines] of Object.entries(captions)) {
  const srt =
    lines
      .map((line, index) => [index + 1, intervals[index].join(' --> '), line].join('\n'))
      .join('\n\n') + '\n';
  const subtitlePath = join(videoRoot, locale + '.srt');
  await writeFile(subtitlePath, srt);
  const screenshotRoot = join(assetRoot, locale);
  const inputs = ['01-date-on-reel.png', '02-settings.png', '03-below-reel.png'].flatMap(
    (file) => [
      '-loop',
      '1',
      '-framerate',
      '30',
      '-t',
      '6',
      '-i',
      join(screenshotRoot, file),
    ],
  );
  const style =
    'FontName=Arial,FontSize=14,PrimaryColour=&H00FFFFFF,' +
    'BackColour=&H90071530,BorderStyle=3,Outline=0,Shadow=0,' +
    'Alignment=2,MarginV=12';
  const scale =
    'fps=30,scale=1024:640,pad=1280:720:128:0:color=0x0b1630,' +
    'setsar=1,format=yuv420p';
  const filter = [
    '[0:v]' + scale + '[v0]',
    '[1:v]' + scale + '[v1]',
    '[2:v]' + scale + '[v2]',
    '[v0][v1]xfade=transition=fade:duration=0.5:offset=5.5[x1]',
    '[x1][v2]xfade=transition=fade:duration=0.5:offset=11[x2]',
    '[x2]subtitles=' + subtitlePath + ":force_style='" + style + "'[v]",
  ].join(';');
  const output = join(videoRoot, 'demo-' + locale + '.mp4');
  await run('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    ...inputs,
    '-filter_complex',
    filter,
    '-map',
    '[v]',
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '23',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    output,
  ]);
  process.stdout.write('Rendered ' + locale + ' video\n');
}

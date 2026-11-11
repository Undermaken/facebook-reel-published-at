import { build, context } from 'esbuild';
import { copyFile, cp, mkdir, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const file of ['manifest.json', 'popup.html', 'popup.css']) {
  await copyFile(file, `dist/${file}`);
}
await cp('_locales', 'dist/_locales', { recursive: true });
await copyFile('node_modules/date-fns/LICENSE.md', 'dist/DATE_FNS_LICENSE.txt');
await copyFile('node_modules/zod/LICENSE', 'dist/ZOD_LICENSE.txt');
const options = {
  entryPoints: ['src/main.ts', 'src/content.ts', 'src/popup.ts'],
  bundle: true,
  outdir: 'dist',
  format: 'iife',
  platform: 'browser',
  target: 'chrome111',
  legalComments: 'none',
  logLevel: 'info',
};

if (process.argv.includes('--watch')) {
  const watcher = await context(options);
  await watcher.watch();
  console.log(
    'Watching TypeScript and CSS. Reload the extension and Facebook after changes.',
  );
} else {
  await build(options);
}

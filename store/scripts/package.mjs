import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const run = promisify(execFile);
const storeRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = resolve(storeRoot, '..', 'dist');
const outputRoot = join(storeRoot, 'output');
const manifest = JSON.parse(await readFile(join(distRoot, 'manifest.json'), 'utf8'));
const output = join(outputRoot, 'facebook-reel-dates-' + manifest.version + '.zip');

await mkdir(outputRoot, { recursive: true });
await rm(output, { force: true });
await run('zip', ['-q', '-X', '-r', output, '.'], { cwd: distRoot });
const { stdout } = await run('unzip', ['-Z', '-1', output]);
const entries = stdout.trim().split('\n');
for (const required of [
  'manifest.json',
  'main.js',
  'content.js',
  'popup.html',
  'popup.js',
  ...Object.values(manifest.icons),
  ...Object.values(manifest.action.default_icon),
]) {
  if (!entries.includes(required)) throw new Error('Missing ZIP entry: ' + required);
}
if (entries.some((entry) => entry.startsWith('dist/') || entry.includes('.DS_Store'))) {
  throw new Error('The ZIP contains an unexpected root or Finder metadata.');
}
const hash = createHash('sha256')
  .update(await readFile(output))
  .digest('hex');
await writeFile(
  join(outputRoot, 'SHA256.txt'),
  hash + '  ' + output.split('/').at(-1) + '\n',
);
process.stdout.write(output + '\nSHA-256: ' + hash + '\n');

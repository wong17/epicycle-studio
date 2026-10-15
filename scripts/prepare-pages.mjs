import { copyFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const result = spawnSync(
  process.execPath,
  ['node_modules/@angular/cli/bin/ng.js', 'build', ...process.argv.slice(2)],
  { stdio: 'inherit' },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

// Angular writes notices beside browser/. Ship them with the uploadable site.
const notices = 'dist/epicycle-studio/3rdpartylicenses.txt';
if (existsSync(notices)) {
  copyFileSync(notices, 'dist/epicycle-studio/browser/3rdpartylicenses.txt');
}

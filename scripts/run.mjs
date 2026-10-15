import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
const local = resolve('.tools/node_modules/node-win-x64/bin/node.exe');
const node = existsSync(local) ? local : process.execPath;
const target = process.argv[2];
const paths = {
  ng: 'node_modules/@angular/cli/bin/ng.js',
  eslint: 'node_modules/eslint/bin/eslint.js',
  prettier: 'node_modules/prettier/bin/prettier.cjs',
  playwright: 'node_modules/@playwright/test/cli.js',
};
const child = spawn(node, [paths[target] ?? target, ...process.argv.slice(3)], {
  stdio: 'inherit',
});
child.on('exit', (code) => process.exit(code ?? 1));

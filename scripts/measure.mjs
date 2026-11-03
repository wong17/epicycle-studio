import {
  readFileSync,
  mkdirSync,
  writeFileSync,
  readdirSync,
  mkdtempSync,
  unlinkSync,
  rmdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
mkdirSync('artifacts/measurements', { recursive: true });
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const rows = Object.entries({ ...pkg.dependencies, ...pkg.devDependencies }).map(([name]) => {
  const p = JSON.parse(readFileSync(`node_modules/${name}/package.json`, 'utf8'));
  return `| ${name} | ${p.version} | ${typeof p.license === 'string' ? p.license : JSON.stringify(p.license)} | [npm](https://www.npmjs.com/package/${name}) |`;
});
writeFileSync(
  'artifacts/measurements/dependencies.md',
  `# Dependencias resueltas\n\nNode de ejecución: 24.15.0 local; Angular: 22.2.2. Versiones y licencias leídas de los manifiestos instalados. package-lock.json conserva la resolución exacta; usar npm ci.\n\n| Paquete | Versión | Licencia declarada | Fuente |\n|---|---|---|---|\n${rows.join('\n')}\n\nfft.js es CommonJS: sólo este paquete se permite explícitamente en el build. La matemática usa doble precisión; Three.js convierte geometría a Float32. Ningún recurso gráfico externo es necesario. El CLI genera Vitest 5.0.4 y TypeScript compatible; no se sustituyó su runner.\n`,
);
const files = readdirSync('dist/epicycle-studio/browser')
  .filter((x) => x.endsWith('.js'))
  .map((name) => {
    const bytes = readFileSync(`dist/epicycle-studio/browser/${name}`);
    return { name, bytes: bytes.length, gzip: gzipSync(bytes).length };
  });
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'epicycle-measure-'));
const temporaryModule = join(temporaryDirectory, 'math-perf.mjs');
let math;
try {
  await build({
    entryPoints: ['src/app/domain/fourier/math.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: temporaryModule,
  });
  math = await import(pathToFileURL(temporaryModule).href);
} finally {
  try {
    unlinkSync(temporaryModule);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  rmdirSync(temporaryDirectory);
}
const timing = [];
for (let i = 0; i < 25; i++) {
  const s = math.sampleCurve(2, 2048, (t) => [
      Math.cos(2 * Math.PI * 3 * t),
      Math.sin(2 * Math.PI * 7 * t),
    ]),
    start = performance.now();
  math.analyze2D(s);
  timing.push(performance.now() - start);
}
timing.sort((a, b) => a - b);
writeFileSync(
  'artifacts/measurements/bundle-measured.json',
  JSON.stringify(
    {
      files,
      fft2048: { runs: 25, median: timing[12], p95: timing[23], node: process.version },
      note: 'FFT pure CPU benchmark; excludes worker startup and UI preparation.',
    },
    null,
    2,
  ),
);

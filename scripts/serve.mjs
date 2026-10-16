import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('dist/epicycle-studio/browser'),
  port = Number(process.env.EPICYCLE_PORT ?? 4200),
  mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.json': 'application/json',
    '.png': 'image/png',
  };
// Apply the deployment's global security headers in local production previews too.
const headerFile = await readFile(resolve(root, '_headers'), 'utf8');
const globalBlock = headerFile.match(/^\/\*\r?\n((?:[ \t]+[^\r\n]*\r?\n)+)/m)?.[1];
if (!globalBlock) throw new Error('Build is missing global security headers');
const securityHeaders = Object.fromEntries(
  globalBlock
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const separator = line.indexOf(':');
      if (separator < 1) throw new Error('Invalid deployment security header');
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }),
);
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname),
      path = resolve(root, '.' + pathname);
    if (path !== root && !path.startsWith(root + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    let target = path;
    try {
      if (!(await stat(target)).isFile()) target = resolve(root, 'index.html');
    } catch {
      if (extname(path)) {
        res.writeHead(404);
        res.end('Asset not found');
        return;
      }
      target = resolve(root, 'index.html');
    }
    const bytes = await readFile(target);
    res.writeHead(200, {
      ...securityHeaders,
      'Content-Type': mime[extname(target)] ?? 'application/octet-stream',
      'Cache-Control': extname(target) === '.html' ? 'no-cache' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(bytes);
  } catch {
    res.writeHead(500);
    res.end('Build unavailable. Run npm run build.');
  }
}).listen(port, '127.0.0.1', () =>
  process.stdout.write(`Epicycle Studio: http://127.0.0.1:${port}\n`),
);

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getPublicDir(): string {
  const candidates = [
    path.resolve(process.cwd(), 'tests/fixtures/public'),
    path.resolve(__dirname, 'public'),
    path.resolve(__dirname, '../../tests/fixtures/public'),
    path.resolve(__dirname, '../fixtures/public'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

const publicDir = getPublicDir();

export function createFixtureServer(port = 8080): http.Server {
  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url || '/', `http://127.0.0.1:${port}`);
    let pathname = parsedUrl.pathname;

    console.log(`[Fixture Server] ${req.method} ${pathname}`);

    // Redirect test
    if (pathname === '/redirect') {
      res.writeHead(302, { Location: '/search' });
      res.end();
      return;
    }

    // 404 test API endpoint
    if (pathname.startsWith('/api/')) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Endpoint not found on fixture server', status: 404 }));
      return;
    }

    if (pathname === '/') pathname = '/index.html';
    if (!pathname.includes('.')) pathname = `${pathname}.html`;

    const filePath = path.join(publicDir, pathname);

    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, {
        'Content-Type': filePath.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/plain',
      });
      res.end(content);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found on Browser Nova Fixture Server');
    }
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`[Fixture Server] Running on http://127.0.0.1:${port}`);
  });

  return server;
}

// If run directly
if (process.argv[1] && (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'))) {
  createFixtureServer(8080);
}

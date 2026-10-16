import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import type { ClientMsg } from '../shared/protocol.ts';
import { Hub } from './hub.ts';
import { log } from './log.ts';

const PORT = Number(process.env.API_PORT ?? process.env.PORT ?? 3001);
const STATIC_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../dist/web');
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  // Üretimde derlenmiş web istemcisini sun (SPA fallback).
  if (!existsSync(STATIC_DIR)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Web istemcisi derlenmemiş. Geliştirme için `npm run dev`, üretim için `npm run build`.');
    return;
  }
  let file = normalize(join(STATIC_DIR, decodeURIComponent(url.pathname)));
  if (!file.startsWith(STATIC_DIR) || !existsSync(file) || statSync(file).isDirectory()) {
    file = join(STATIC_DIR, 'index.html');
  }
  const ext = extname(file);
  res.writeHead(200, {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  createReadStream(file).pipe(res);
});

const hub = new Hub();
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });

wss.on('connection', (ws, req) => {
  // Origin kontrolü: tarayıcıdan gelen bağlantı aynı host'tan olmalı.
  const origin = req.headers.origin;
  if (origin && process.env.ALLOW_ANY_ORIGIN !== '1') {
    try {
      if (new URL(origin).host !== req.headers.host) {
        ws.close(1008, 'origin');
        return;
      }
    } catch {
      ws.close(1008, 'origin');
      return;
    }
  }

  // Basit hız limiti: saniyede en fazla 20 mesaj.
  let tokens = 20;
  let last = Date.now();
  let alive = true;
  ws.on('pong', () => (alive = true));
  const hb = setInterval(() => {
    if (!alive) return ws.terminate();
    alive = false;
    ws.ping();
  }, 15000);

  ws.on('message', (raw) => {
    const now = Date.now();
    tokens = Math.min(20, tokens + ((now - last) / 1000) * 20);
    last = now;
    if (tokens < 1) {
      ws.send(JSON.stringify({ t: 'error', code: 'RATE_LIMITED', message: 'Çok hızlı istek gönderiyorsunuz.' }));
      return;
    }
    tokens--;
    let msg: ClientMsg;
    try {
      msg = JSON.parse(String(raw));
      if (!msg || typeof msg.t !== 'string') throw new Error();
    } catch {
      return;
    }
    try {
      hub.handle(ws, msg);
    } catch (e) {
      log('ws.error', { error: String(e) });
    }
  });
  ws.on('close', () => {
    clearInterval(hb);
    hub.onClose(ws);
  });
});

server.listen(PORT, () => log('server.listening', { port: PORT }));

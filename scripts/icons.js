// Gera os ícones do site e do app Android a partir do desenho real dos azulejos do jogo.
// Uso: node scripts/icons.js   (precisa do Playwright)
'use strict';
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/json' };

const TARGETS = [
  ['icons/icon-192.png', 192, 'round'],
  ['icons/icon-512.png', 512, 'round'],
  ['icons/icon-maskable-512.png', 512, 'maskable'],
  ['icons/apple-touch-icon.png', 180, 'square'],
  ...[['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]
    .map(([d, s]) => [`android/app/src/main/res/mipmap-${d}/ic_launcher.png`, s, 'round']),
];

const srv = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const f = path.join(ROOT, rel);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0, '127.0.0.1', async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${srv.address().port}/`);
  await page.waitForFunction(() => window.__azulejo && window.__azulejo.sprite);
  for (const [file, size, kind] of TARGETS) {
    const data = await page.evaluate(([size, kind]) => {
      const c = document.createElement('canvas'); c.width = c.height = size;
      const x = c.getContext('2d');
      const rr = (X, Y, W, H, R) => { x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R); x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath(); };
      const g = x.createRadialGradient(size / 2, size * 0.2, 0, size / 2, size * 0.45, size * 0.8);
      g.addColorStop(0, '#1f3a7a'); g.addColorStop(1, '#0b1530');
      x.fillStyle = g;
      if (kind === 'round') { rr(0, 0, size, size, size * 0.22); x.fill(); } else x.fillRect(0, 0, size, size);
      // moldura dourada
      const inset = kind === 'maskable' ? 0.2 : 0.1, a = size * inset, w = size - 2 * a;
      const gold = x.createLinearGradient(a, a, a + w, a + w);
      gold.addColorStop(0, '#ffe7a3'); gold.addColorStop(0.5, '#b9822a'); gold.addColorStop(1, '#f0c463');
      rr(a - size * 0.025, a - size * 0.025, w + size * 0.05, w + size * 0.05, size * 0.09); x.fillStyle = gold; x.fill();
      rr(a, a, w, w, size * 0.07); x.fillStyle = '#0e1c42'; x.fill();
      // 2x2 azulejos em relevo (cobalto, âmbar, esmeralda, rubi)
      const cell = w / 2;
      [[0, 0, 0], [1, 0, 1], [0, 1, 2], [1, 1, 3]].forEach(([i, j, ci]) => {
        const sp = window.__azulejo.sprite(ci, cell);
        x.drawImage(sp.cv, a + i * cell - sp.pad, a + j * cell - sp.pad, sp.full, sp.full);
      });
      return c.toDataURL('image/png');
    }, [size, kind]);
    fs.writeFileSync(path.join(ROOT, file), Buffer.from(data.split(',')[1], 'base64'));
    console.log('ok', file);
  }
  await browser.close(); srv.close();
});

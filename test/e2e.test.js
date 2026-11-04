'use strict';
// Testes de ponta a ponta: abrem o jogo num Chromium real e jogam com o mouse.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

let chromium;
try { ({ chromium } = require('playwright')); } catch { /* sem Playwright: pula */ }

const ROOT = path.join(__dirname, '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain',
};

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    }).listen(0, '127.0.0.1', () => resolve(srv));
  });
}

test('jogo no navegador', { skip: !chromium && 'Playwright não instalado' }, async t => {
  const srv = await serve();
  const browser = await chromium.launch();
  t.after(async () => { await browser.close(); srv.close(); });
  const url = `http://127.0.0.1:${srv.address().port}/`;

  /** Abre o jogo numa sessão limpa (sem nada salvo). `external` lista pedidos para fora do site. */
  async function open(viewport = { width: 400, height: 780 }) {
    const page = await browser.newPage({ viewport });
    const errors = [], external = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (!r.url().startsWith(url) && !r.url().startsWith('data:')) external.push(r.url()); });
    await page.goto(url);
    await ready(page);
    return { page, errors, external };
  }
  const ready = page => page.waitForFunction(() => window.__azulejo && window.__azulejo.layout.cell > 0);
  const snapshot = page => page.evaluate(() => JSON.stringify(window.__azulejo.state));

  /** Arrasta a peça `idx` da bandeja até a célula (gx, gy). */
  async function dragPiece(page, idx, gx, gy) {
    const pos = await page.evaluate(([idx, gx, gy]) => {
      const { state, layout: L } = window.__azulejo;
      const A = window.AzulejoLogic;
      const sd = A.SHAPE_DATA[state.tray[idx].s];
      const r = document.getElementById('cv').getBoundingClientRect();
      return {
        from: { x: r.left + L.slots[idx].x, y: r.top + L.slots[idx].y },
        to: { x: r.left + L.bx + (gx + sd.w / 2) * L.cell, y: r.top + L.by + (gy + sd.h / 2) * L.cell },
      };
    }, [idx, gx, gy]);
    await page.mouse.move(pos.from.x, pos.from.y);
    await page.mouse.down();
    await page.mouse.move(pos.to.x, pos.to.y, { steps: 10 });
    await page.mouse.up();
  }

  /** Primeira jogada válida para a peça `idx`. */
  const firstSpot = (page, idx) => page.evaluate(idx => {
    const { state } = window.__azulejo, A = window.AzulejoLogic;
    const sd = A.SHAPE_DATA[state.tray[idx].s];
    for (let y = 0; y <= 8 - sd.h; y++) for (let x = 0; x <= 8 - sd.w; x++)
      if (A.canPlace(state.grid, sd, x, y)) return [x, y];
    return null;
  }, idx);

  await t.test('abre sem erros, com 3 peças e placar zerado', async () => {
    const { page, errors } = await open();
    assert.equal(await page.title(), 'Azulejo');
    assert.equal(await page.textContent('#score'), '0');
    assert.equal(await page.evaluate(() => window.__azulejo.state.tray.filter(Boolean).length), 3);
    assert.equal(await page.isVisible('#over'), false);
    assert.deepEqual(errors, []);
    await page.close();
  });

  await t.test('arrastar uma peça para o painel coloca os azulejos e soma pontos', async () => {
    const { page, errors } = await open();
    const [gx, gy] = await firstSpot(page, 0);
    const size = await page.evaluate(() => window.AzulejoLogic.SHAPE_DATA[window.__azulejo.state.tray[0].s].cells.length);
    await dragPiece(page, 0, gx, gy);
    assert.equal(await page.evaluate(() => window.__azulejo.state.tray[0]), null);
    assert.ok(Number(await page.textContent('#score')) >= size);
    assert.deepEqual(errors, []);
    await page.close();
  });

  await t.test('soltar fora do painel devolve a peça para a bandeja', async () => {
    const { page } = await open();
    const before = await page.evaluate(() => JSON.stringify(window.__azulejo.state));
    const r = await page.locator('#cv').boundingBox();
    const slot = await page.evaluate(() => window.__azulejo.layout.slots[1]);
    await page.mouse.move(r.x + slot.x, r.y + slot.y);
    await page.mouse.down();
    await page.mouse.move(r.x + slot.x, r.y + r.height - 2, { steps: 5 });
    await page.mouse.up();
    assert.equal(await page.evaluate(() => JSON.stringify(window.__azulejo.state)), before);
    await page.close();
  });

  await t.test('completar uma linha limpa o painel e mostra a pontuação', async () => {
    const { page } = await open();
    await page.evaluate(() => {
      const { state } = window.__azulejo, A = window.AzulejoLogic;
      const one = A.SHAPES.findIndex(s => s.join() === '#');
      state.grid = A.emptyGrid();
      for (let x = 1; x < 8; x++) state.grid[2][x] = 3;
      state.grid[6][6] = 2;
      state.tray = [{ s: one, c: 0 }, { s: one, c: 1 }, { s: one, c: 2 }];
    });
    await dragPiece(page, 0, 0, 2);
    const s = await page.evaluate(() => window.__azulejo.state);
    assert.ok(s.grid[2].every(v => v === -1));
    assert.equal(s.grid[6][6], 2);
    assert.equal(await page.textContent('#score'), '11');
    await page.close();
  });

  await t.test('fim de jogo mostra o aviso, e "Jogar de novo" recomeça', async () => {
    const { page } = await open();
    await page.evaluate(() => {
      const { state } = window.__azulejo, A = window.AzulejoLogic;
      const idx = r => A.SHAPES.findIndex(s => s.join() === r);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) state.grid[y][x] = (x + y) % 2 === 0 ? 1 : -1;
      state.tray = [{ s: idx('#'), c: 0 }, { s: idx('##'), c: 1 }, { s: idx('#####'), c: 2 }];
    });
    await dragPiece(page, 0, 1, 0);
    await page.waitForSelector('#over', { state: 'visible' });
    assert.equal(await page.textContent('#final'), '1');
    await page.click('#again');
    assert.equal(await page.isVisible('#over'), false);
    assert.equal(await page.textContent('#score'), '0');
    assert.ok(await page.evaluate(() => window.__azulejo.state.grid.every(r => r.every(v => v === -1))));
    await page.close();
  });

  await t.test('recorde fica salvo entre recarregamentos', async () => {
    const { page } = await open();
    const [gx, gy] = await firstSpot(page, 0);
    await dragPiece(page, 0, gx, gy);
    const score = await page.textContent('#score');
    await page.reload();
    await page.waitForFunction(() => window.__azulejo);
    assert.equal(await page.textContent('#best'), score);
    await page.close();
  });

  await t.test('partida em andamento continua depois de recarregar a página', async () => {
    const { page } = await open();
    const [gx, gy] = await firstSpot(page, 0);
    await dragPiece(page, 0, gx, gy);
    const before = await snapshot(page);
    const score = await page.textContent('#score');
    await page.reload();
    await ready(page);
    assert.equal(await snapshot(page), before);
    assert.equal(await page.textContent('#score'), score);
    await page.close();
  });

  await t.test('partida salva corrompida é ignorada e começa um jogo novo', async () => {
    const { page, errors } = await open();
    await page.evaluate(() => localStorage.setItem('azulejo-game', '{"v":1,"grid":"lixo"}'));
    await page.reload();
    await ready(page);
    assert.equal(await page.textContent('#score'), '0');
    assert.equal(await page.evaluate(() => window.__azulejo.state.tray.filter(Boolean).length), 3);
    assert.deepEqual(errors, []);
    await page.close();
  });

  await t.test('depois do fim de jogo, recarregar começa uma partida nova', async () => {
    const { page } = await open();
    await page.evaluate(() => {
      const { state } = window.__azulejo, A = window.AzulejoLogic;
      const idx = r => A.SHAPES.findIndex(s => s.join() === r);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) state.grid[y][x] = (x + y) % 2 === 0 ? 1 : -1;
      state.tray = [{ s: idx('#'), c: 0 }, { s: idx('##'), c: 1 }, { s: idx('#####'), c: 2 }];
    });
    await dragPiece(page, 0, 1, 0);
    await page.waitForSelector('#over', { state: 'visible' });
    await page.reload();
    await ready(page);
    assert.equal(await page.isVisible('#over'), false);
    assert.equal(await page.textContent('#score'), '0');
    await page.close();
  });

  await t.test('botão recomeçar pede um segundo toque no meio da partida', async () => {
    const { page } = await open();
    const [gx, gy] = await firstSpot(page, 0);
    await dragPiece(page, 0, gx, gy);
    const score = await page.textContent('#score');
    await page.click('#restart');
    assert.equal(await page.textContent('#score'), score, 'um toque só não pode apagar a partida');
    assert.equal(await page.getAttribute('#restart', 'aria-label'), 'Toque de novo para recomeçar');
    await page.click('#restart');
    assert.equal(await page.textContent('#score'), '0');
    assert.equal(await page.getAttribute('#restart', 'aria-label'), 'Recomeçar');
    await page.close();
  });

  await t.test('botão recomeçar volta ao normal se não houver segundo toque', async () => {
    const { page } = await open();
    const [gx, gy] = await firstSpot(page, 0);
    await dragPiece(page, 0, gx, gy);
    await page.click('#restart');
    await page.waitForFunction(() => !document.getElementById('restart').classList.contains('armed'), null, { timeout: 4000 });
    await page.click('#restart');
    assert.notEqual(await page.textContent('#score'), '0');
    await page.close();
  });

  await t.test('não carrega nada de fora do site e usa as fontes locais', async () => {
    const { page, external } = await open();
    await page.evaluate(() => document.fonts.ready);
    assert.deepEqual(external, []);
    assert.ok(await page.evaluate(() => document.fonts.check('16px "Bagel Fat One"') && document.fonts.check('600 16px Figtree')));
    await page.close();
  });

  await t.test('manifesto do app é válido e os ícones existem', async () => {
    const { page } = await open();
    const href = await page.getAttribute('link[rel="manifest"]', 'href');
    const res = await page.request.get(url + href);
    assert.equal(res.status(), 200);
    const m = await res.json();
    assert.equal(m.name, 'Azulejo');
    assert.equal(m.display, 'standalone');
    assert.equal(m.start_url, './');
    assert.ok(m.icons.some(i => i.sizes === '512x512' && i.purpose === 'maskable'));
    for (const icon of m.icons) {
      const r = await page.request.get(url + icon.src);
      assert.equal(r.status(), 200, icon.src);
      assert.equal(r.headers()['content-type'], 'image/png');
      const size = await page.evaluate(async src => {
        const img = new Image(); img.src = src; await img.decode(); return img.naturalWidth + 'x' + img.naturalHeight;
      }, icon.src);
      assert.equal(size, icon.sizes, icon.src);
    }
    await page.close();
  });

  await t.test('funciona offline depois da primeira visita, com a partida salva', async () => {
    const context = await browser.newContext({ viewport: { width: 400, height: 780 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url);
    await ready(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    const [gx, gy] = await firstSpot(page, 0);
    await dragPiece(page, 0, gx, gy);
    const before = await snapshot(page);

    await context.setOffline(true);
    await page.reload();
    await ready(page);
    assert.equal(await snapshot(page), before);
    assert.ok(await page.evaluate(() => document.fonts.ready.then(() => document.fonts.check('16px "Bagel Fat One"'))));
    assert.deepEqual(errors, []);
    await context.close();
  });

  await t.test('aviso de instalação aparece quando o navegador oferece e some ao fechar', async () => {
    const { page } = await open();
    assert.equal(await page.isVisible('#install'), false);
    await page.evaluate(() => {
      const e = new Event('beforeinstallprompt', { cancelable: true });
      e.prompt = () => { window.__prompted = true; };
      e.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(e);
    });
    assert.equal(await page.isVisible('#install'), true);
    await page.click('#installBtn');
    assert.equal(await page.evaluate(() => window.__prompted), true);
    await page.waitForSelector('#install', { state: 'hidden' });

    await page.evaluate(() => { const e = new Event('beforeinstallprompt'); e.prompt = () => {}; window.dispatchEvent(e); });
    await page.click('#installClose');
    assert.equal(await page.isVisible('#install'), false);
    await page.reload(); await ready(page);
    await page.evaluate(() => { const e = new Event('beforeinstallprompt'); e.prompt = () => {}; window.dispatchEvent(e); });
    assert.equal(await page.isVisible('#install'), false, 'depois de fechado, o aviso não volta');
    await page.close();
  });

  await t.test('cabe numa tela de celular sem rolagem lateral', async () => {
    const { page } = await open({ width: 360, height: 640 });
    const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    assert.ok(sw <= cw, `rolagem lateral: ${sw} > ${cw}`);
    const box = await page.locator('#cv').boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 360);
    assert.ok(box.y + box.height <= 640);
    await page.close();
  });
});

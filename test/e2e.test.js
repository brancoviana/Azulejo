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
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };

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

  async function open(viewport = { width: 400, height: 780 }) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto(url);
    await page.waitForFunction(() => window.__azulejo && window.__azulejo.layout.cell > 0);
    return { page, errors };
  }

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

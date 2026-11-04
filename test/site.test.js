'use strict';
// Confere que os arquivos do site e do app instalável estão completos e coerentes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const exists = f => fs.existsSync(path.join(ROOT, f));

function swFiles() {
  const src = read('sw.js');
  const list = src.match(/const FILES = \[([\s\S]*?)\];/)[1];
  return [...list.matchAll(/'([^']+)'/g)].map(m => m[1]);
}

test('service worker: todos os arquivos da lista existem', () => {
  for (const f of swFiles()) if (f !== './') assert.ok(exists(f), `falta ${f}`);
});

test('service worker guarda tudo que a página carrega', () => {
  const html = read('index.html');
  const refs = [
    ...[...html.matchAll(/(?:src|href)="([^"#:]+)"/g)].map(m => m[1]),
    ...[...html.matchAll(/url\((fonts\/[^)]+)\)/g)].map(m => m[1]),
  ];
  const cached = new Set(swFiles());
  for (const r of new Set(refs)) {
    assert.ok(exists(r), `index.html aponta para ${r}, que não existe`);
    assert.ok(cached.has(r), `${r} não está no cache offline (sw.js)`);
  }
  for (const i of JSON.parse(read('manifest.webmanifest')).icons) assert.ok(cached.has(i.src), i.src);
});

test('página não depende de servidores externos', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /(?:src|href)="https?:/);
  assert.doesNotMatch(html, /url\(https?:/);
});

test('fontes incluídas vêm com a licença', () => {
  assert.ok(exists('fonts/OFL.txt'));
  assert.match(read('fonts/OFL.txt'), /SIL OPEN FONT LICENSE/);
});

test('workflow publica todos os arquivos do app', () => {
  const wf = read('.github/workflows/ci.yml');
  for (const f of ['index.html', 'logic.js', 'sw.js', 'manifest.webmanifest', 'icons', 'fonts'])
    assert.match(wf, new RegExp(`cp[^\\n]*\\b${f.replace('.', '\\.')}\\b`), `workflow não copia ${f}`);
});

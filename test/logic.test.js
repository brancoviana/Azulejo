'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../logic.js');

const shapeIndex = rows => A.SHAPES.findIndex(s => s.join('|') === rows.join('|'));
const ONE = shapeIndex(['#']);
const H2 = shapeIndex(['##']);
const H5 = shapeIndex(['#####']);
const SQ3 = shapeIndex(['###', '###', '###']);

/** Estado com bandeja fixa (peças em `shapes`), cor 0. */
function stateWith(shapes, fill = []) {
  const st = A.newState();
  st.tray = shapes.map(s => ({ s, c: 0 }));
  fill.forEach(([x, y, c = 1]) => { st.grid[y][x] = c; });
  return st;
}
const fillRow = (y, except = []) =>
  Array.from({ length: A.N }, (_, x) => x).filter(x => !except.includes(x)).map(x => [x, y]);

test('formas: todas são válidas, sem linhas vazias e dentro de 5x5', () => {
  assert.ok(A.SHAPES.length >= 30);
  for (const sd of A.SHAPE_DATA) {
    assert.ok(sd.cells.length > 0);
    assert.ok(sd.w <= 5 && sd.h <= 5);
    for (let r = 0; r < sd.h; r++) assert.ok(sd.cells.some(([cr]) => cr === r), 'linha vazia');
    for (let c = 0; c < sd.w; c++) assert.ok(sd.cells.some(([, cc]) => cc === c), 'coluna vazia');
  }
});

test('formas: não há duplicadas', () => {
  const keys = A.SHAPES.map(s => s.join('|'));
  assert.equal(new Set(keys).size, keys.length);
});

test('shapeCells converte o desenho em coordenadas [linha, coluna]', () => {
  assert.deepEqual(A.shapeCells(['#.', '##']), [[0, 0], [1, 0], [1, 1]]);
});

test('painel novo é 8x8 e vazio', () => {
  const g = A.emptyGrid();
  assert.equal(g.length, 8);
  assert.ok(g.every(r => r.length === 8 && r.every(v => v === -1)));
});

test('canPlace: aceita dentro do painel, recusa fora dos limites', () => {
  const g = A.emptyGrid();
  const sd = A.SHAPE_DATA[H5];
  assert.equal(A.canPlace(g, sd, 0, 0), true);
  assert.equal(A.canPlace(g, sd, 3, 7), true);
  assert.equal(A.canPlace(g, sd, 4, 0), false);
  assert.equal(A.canPlace(g, sd, -1, 0), false);
  assert.equal(A.canPlace(g, sd, 0, 8), false);
});

test('canPlace: recusa sobreposição com azulejo existente', () => {
  const g = A.emptyGrid();
  g[2][2] = 3;
  const sd = A.SHAPE_DATA[SQ3];
  assert.equal(A.canPlace(g, sd, 0, 0), false);
  assert.equal(A.canPlace(g, sd, 3, 3), true);
});

test('fitsAnywhere: falso com painel cheio, verdadeiro com um buraco para o azulejo único', () => {
  const g = A.emptyGrid().map(r => r.map(() => 0));
  assert.equal(A.fitsAnywhere(g, A.SHAPE_DATA[ONE]), false);
  g[5][6] = -1;
  assert.equal(A.fitsAnywhere(g, A.SHAPE_DATA[ONE]), true);
  assert.equal(A.fitsAnywhere(g, A.SHAPE_DATA[H2]), false);
});

test('linesFor detecta linhas e colunas completas', () => {
  const g = A.emptyGrid();
  for (let x = 0; x < 8; x++) g[3][x] = 0;
  for (let y = 0; y < 8; y++) g[y][6] = 0;
  assert.deepEqual(A.linesFor(g), { rows: [3], cols: [6] });
});

test('lineScore: cresce com linhas simultâneas e com a sequência, limitada a 8x', () => {
  assert.equal(A.lineScore(0, 3), 0);
  assert.equal(A.lineScore(1, 1), 10);
  assert.equal(A.lineScore(2, 1), 30);
  assert.equal(A.lineScore(3, 1), 60);
  assert.equal(A.lineScore(1, 3), 30);
  assert.equal(A.lineScore(1, 50), 10 * A.MAX_STREAK);
});

test('place: jogada sem limpar soma 1 ponto por azulejo e zera a sequência', () => {
  const st = stateWith([SQ3, ONE, ONE]);
  st.streak = 4;
  const r = A.place(st, 0, 0, 0);
  assert.equal(r.gained, 9);
  assert.equal(st.score, 9);
  assert.equal(st.streak, 0);
  assert.equal(st.tray[0], null);
  assert.equal(st.grid[2][2], 0);
});

test('place: jogada inválida devolve null e não muda nada', () => {
  const st = stateWith([H5, ONE, ONE]);
  const before = JSON.stringify(st);
  assert.equal(A.place(st, 0, 5, 0), null);
  assert.equal(A.place(st, 7, 0, 0), null);
  assert.equal(JSON.stringify(st), before);
});

test('place: completar uma linha limpa os azulejos e pontua', () => {
  const st = stateWith([ONE, ONE, ONE], fillRow(7, [4]).concat([[0, 6]]));
  const r = A.place(st, 0, 4, 7);
  assert.deepEqual(r.rows, [7]);
  assert.equal(r.cleared.length, 8);
  assert.ok(st.grid[7].every(v => v === -1));
  assert.equal(st.grid[6][0], 1, 'azulejo fora da linha continua');
  assert.equal(r.gained, 1 + 10);
  assert.equal(st.streak, 1);
});

test('place: linha + coluna ao mesmo tempo contam 2 linhas e não duplicam a célula do cruzamento', () => {
  const fill = fillRow(0, [0]);
  for (let y = 1; y < 8; y++) fill.push([0, y]);
  fill.push([5, 5]);
  const st = stateWith([ONE, ONE, ONE], fill);
  const r = A.place(st, 0, 0, 0);
  assert.equal(r.rows.length + r.cols.length, 2);
  assert.equal(r.cleared.length, 15);
  assert.equal(r.gained, 1 + 30);
});

test('place: sequência de limpezas multiplica os pontos', () => {
  const st = stateWith([ONE, ONE, ONE], [...fillRow(7, [0]), ...fillRow(6, [0]), [3, 3]]);
  assert.equal(A.place(st, 0, 0, 7).lineScore, 10);
  assert.equal(A.place(st, 1, 0, 6).lineScore, 20);
  assert.equal(st.streak, 2);
});

test('place: limpar o painel inteiro dá bônus', () => {
  const st = stateWith([ONE, ONE, ONE], fillRow(4, [7]));
  const r = A.place(st, 0, 7, 4);
  assert.equal(r.boardCleared, true);
  assert.equal(r.gained, 1 + 10 + A.BOARD_CLEAR_BONUS);
});

test('place: ao usar as 3 peças, chegam 3 novas', () => {
  const st = stateWith([ONE, ONE, ONE]);
  const rng = A.seededRng(1);
  A.place(st, 0, 0, 0, rng);
  A.place(st, 1, 1, 0, rng);
  assert.equal(st.tray.filter(Boolean).length, 1);
  const r = A.place(st, 2, 2, 0, rng);
  assert.equal(r.dealt, true);
  assert.equal(st.tray.filter(Boolean).length, 3);
});

test('fim de jogo quando nenhuma peça restante cabe', () => {
  const fill = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2 === 0) fill.push([x, y]);
  // tabuleiro de xadrez: só cabe o azulejo único
  const st = stateWith([ONE, H2, H5], fill);
  assert.equal(A.isGameOver(st), false);
  const r = A.place(st, 0, 1, 0);
  assert.equal(r.over, true);
  assert.equal(st.over, true);
  assert.equal(A.place(st, 1, 3, 0), null, 'não aceita jogadas depois do fim');
});

test('deal: dá 3 peças válidas e tenta garantir que uma caiba', () => {
  const st = A.newState();
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) st.grid[y][x] = 0;
  st.grid[0][0] = -1;
  let ok = 0;
  for (let seed = 1; seed <= 20; seed++) {
    A.deal(st, A.seededRng(seed));
    assert.equal(st.tray.length, 3);
    st.tray.forEach(p => {
      assert.ok(p.s >= 0 && p.s < A.SHAPE_DATA.length);
      assert.ok(p.c >= 0 && p.c < A.COLOR_COUNT);
    });
    if (st.tray.some(p => p.s === ONE)) ok++;
  }
  assert.ok(ok >= 15, `com só 1 espaço livre o azulejo único deve vir quase sempre (veio ${ok}/20)`);
});

test('seededRng é determinístico e fica em [0, 1)', () => {
  const a = A.seededRng(42), b = A.seededRng(42);
  for (let i = 0; i < 1000; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
});

test('partida simulada: pontuação só sobe e o painel fica consistente', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const rng = A.seededRng(seed);
    const st = A.newState();
    A.deal(st, rng);
    let last = 0, moves = 0;
    while (!st.over && moves < 500) {
      let moved = false;
      for (let i = 0; i < 3 && !moved; i++) {
        const p = st.tray[i];
        if (!p) continue;
        const sd = A.SHAPE_DATA[p.s];
        for (let y = 0; y <= 8 - sd.h && !moved; y++)
          for (let x = 0; x <= 8 - sd.w && !moved; x++)
            if (A.canPlace(st.grid, sd, x, y)) { assert.ok(A.place(st, i, x, y, rng)); moved = true; }
      }
      assert.ok(moved || st.over, 'sem jogada possível mas o jogo não acabou');
      assert.ok(st.score > last);
      last = st.score;
      const { rows, cols } = A.linesFor(st.grid);
      assert.equal(rows.length + cols.length, 0, 'linha completa ficou no painel');
      moves++;
    }
    assert.ok(moves > 3);
  }
});

// ---------- dificuldade ----------

test('dificuldade vai de 0 a 1 conforme a pontuação', () => {
  assert.equal(A.difficulty(0), 0);
  assert.equal(A.difficulty(A.DIFFICULTY_MAX_SCORE / 2), 0.5);
  assert.equal(A.difficulty(A.DIFFICULTY_MAX_SCORE * 10), 1);
  assert.equal(A.difficulty(-5), 0);
});

test('pesos: todos positivos; peças pequenas perdem peso e grandes ganham', () => {
  const small = A.SHAPE_DATA[ONE], big = A.SHAPE_DATA[SQ3], line5 = A.SHAPE_DATA[H5];
  for (const score of [0, 1000, 4000, 99999])
    for (const sd of A.SHAPE_DATA) assert.ok(A.pieceWeight(sd, score) > 0);
  assert.ok(A.pieceWeight(small, 0) > A.pieceWeight(small, 4000));
  assert.ok(A.pieceWeight(big, 0) < A.pieceWeight(big, 4000));
  assert.ok(A.pieceWeight(line5, 0) < A.pieceWeight(line5, 4000));
});

test('randPiece: peças grandes ficam bem mais comuns com a pontuação', () => {
  const stats = score => {
    const rng = A.seededRng(7);
    let sum = 0, big = 0, small = 0;
    for (let i = 0; i < 4000; i++) {
      const n = A.SHAPE_DATA[A.randPiece(rng, score).s].cells.length;
      sum += n; if (n >= 5) big++; if (n <= 2) small++;
    }
    return { avg: sum / 4000, big: big / 4000, small: small / 4000 };
  };
  const early = stats(0), late = stats(A.DIFFICULTY_MAX_SCORE);
  assert.ok(late.avg - early.avg > 0.5, `tamanho médio: início ${early.avg.toFixed(2)}, fim ${late.avg.toFixed(2)}`);
  assert.ok(late.big > early.big * 2.5, `grandes: início ${early.big}, fim ${late.big}`);
  assert.ok(late.small < early.small / 2, `pequenas: início ${early.small}, fim ${late.small}`);
});

test('randPiece: todas as formas podem aparecer, mesmo no início', () => {
  const rng = A.seededRng(3), seen = new Set();
  for (let i = 0; i < 20000; i++) seen.add(A.randPiece(rng, 0).s);
  assert.equal(seen.size, A.SHAPE_DATA.length);
});

test('deal usa a pontuação atual para escolher as peças', () => {
  const sizes = score => {
    let sum = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const st = A.newState(); st.score = score;
      A.deal(st, A.seededRng(seed));
      sum += st.tray.reduce((a, p) => a + A.SHAPE_DATA[p.s].cells.length, 0);
    }
    return sum;
  };
  assert.ok(sizes(A.DIFFICULTY_MAX_SCORE) > sizes(0));
});

// ---------- salvar e restaurar ----------

test('serialize + restore devolvem a mesma partida', () => {
  const rng = A.seededRng(11);
  const st = A.newState(); A.deal(st, rng);
  A.place(st, 0, 0, 0, rng);
  st.streak = 2;
  const back = A.restore(A.serialize(st));
  assert.deepEqual(back.grid, st.grid);
  assert.deepEqual(back.tray, st.tray);
  assert.equal(back.score, st.score);
  assert.equal(back.streak, 2);
  assert.equal(back.over, false);
});

test('restore marca fim de jogo se a partida salva já não tem jogada', () => {
  const fill = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2 === 0) fill.push([x, y]);
  const st = stateWith([H2, H5, SQ3], fill);
  assert.equal(A.restore(A.serialize(st)).over, true);
});

test('restore recusa dados corrompidos ou de outra versão', () => {
  const good = JSON.parse(A.serialize(stateWith([ONE, H2, H5])));
  const bad = [
    'não é json', 'null', '[]', '{}',
    { ...good, v: 999 },
    { ...good, grid: good.grid.slice(1) },
    { ...good, grid: good.grid.map((r, i) => i === 0 ? r.slice(1) : r) },
    { ...good, grid: good.grid.map((r, i) => i === 0 ? [99, ...r.slice(1)] : r) },
    { ...good, tray: [null, null, null] },
    { ...good, tray: [{ s: 9999, c: 0 }, null, null] },
    { ...good, tray: [{ s: 0, c: -1 }, null, null] },
    { ...good, tray: [{ s: 0, c: 0 }] },
    { ...good, score: -1 },
    { ...good, score: 1.5 },
    { ...good, streak: 'x' },
    { ...good, grid: good.grid.map((r, i) => i === 0 ? r.map(() => 0) : r) }, // linha completa não limpa
  ];
  for (const b of bad) {
    const txt = typeof b === 'string' ? b : JSON.stringify(b);
    assert.equal(A.restore(txt), null, txt.slice(0, 80));
  }
});

// ---------- dica ----------

test('findMove devolve uma jogada válida quando existe', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const rng = A.seededRng(seed);
    const st = A.newState(); A.deal(st, rng);
    for (let i = 0; i < 12 && !st.over; i++) {
      const m = A.findMove(st);
      assert.ok(m, 'jogo não acabou mas a dica não achou jogada');
      assert.ok(A.canPlace(st.grid, A.SHAPE_DATA[st.tray[m.idx].s], m.gx, m.gy));
      A.place(st, m.idx, m.gx, m.gy, rng);
    }
  }
});

test('findMove devolve null quando nenhuma peça cabe', () => {
  const fill = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2 === 0) fill.push([x, y]);
  assert.equal(A.findMove(stateWith([H2, H5, SQ3], fill)), null);
});

test('findMove prefere a jogada que limpa linhas', () => {
  const st = stateWith([SQ3, ONE, H2], fillRow(7, [6]));
  const m = A.findMove(st);
  assert.equal(m.lines, 1);
  assert.equal(st.tray[m.idx].s === ONE ? `${m.gx},${m.gy}` : 'outra', '6,7');
});

test('findMove acha a jogada escondida das partidas reportadas (L amarelo no canto)', () => {
  // Painel da partida com 208 pontos: só o L cabia, no canto de cima à esquerda.
  const rows = [
    '........',
    '.#######',
    '..###.##',
    '#.######',
    '.######.',
    '#.###.#.',
    '#######.',
    '.#######',
  ];
  const st = A.newState();
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') st.grid[y][x] = 1; }));
  const L = shapeIndex(['#.', '#.', '##']);
  const S = shapeIndex(['.#', '##', '#.']);
  st.tray = [null, { s: L, c: 1 }, { s: S, c: 2 }];
  assert.equal(A.isGameOver(st), false);
  const m = A.findMove(st);
  assert.deepEqual([m.idx, m.gx, m.gy], [1, 0, 0]);
});

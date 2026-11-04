/* Azulejo — regras do jogo (sem DOM). Usado pelo navegador e pelos testes. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AzulejoLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const N = 8;
  const COLOR_COUNT = 6;
  const MAX_STREAK = 8;
  const BOARD_CLEAR_BONUS = 300;

  const SHAPES = [
    ['#'], ['##'], ['#', '#'], ['###'], ['#', '#', '#'], ['####'], ['#', '#', '#', '#'], ['#####'], ['#', '#', '#', '#', '#'],
    ['##', '##'], ['###', '###', '###'], ['###', '###'], ['##', '##', '##'],
    ['#.', '##'], ['.#', '##'], ['##', '#.'], ['##', '.#'],
    ['#..', '###'], ['..#', '###'], ['###', '#..'], ['###', '..#'],
    ['#.', '#.', '##'], ['.#', '.#', '##'], ['##', '#.', '#.'], ['##', '.#', '.#'],
    ['###', '.#.'], ['.#.', '###'], ['#.', '##', '#.'], ['.#', '##', '.#'],
    ['##.', '.##'], ['.##', '##.'], ['#.', '##', '.#'], ['.#', '##', '#.'],
    ['#..', '#..', '###'], ['..#', '..#', '###'], ['###', '#..', '#..'], ['###', '..#', '..#'],
  ];

  function shapeCells(rows) {
    const cells = [];
    rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') cells.push([r, c]); }));
    return cells;
  }

  const SHAPE_DATA = SHAPES.map(s => ({ cells: shapeCells(s), w: s[0].length, h: s.length }));

  function emptyGrid() {
    return Array.from({ length: N }, () => Array(N).fill(-1));
  }

  function newState() {
    return { grid: emptyGrid(), tray: [], score: 0, streak: 0, over: false };
  }

  function canPlace(grid, sd, gx, gy) {
    for (const [r, c] of sd.cells) {
      const x = gx + c, y = gy + r;
      if (x < 0 || y < 0 || x >= N || y >= N || grid[y][x] >= 0) return false;
    }
    return true;
  }

  function fitsAnywhere(grid, sd) {
    for (let y = 0; y <= N - sd.h; y++)
      for (let x = 0; x <= N - sd.w; x++)
        if (canPlace(grid, sd, x, y)) return true;
    return false;
  }

  function linesFor(grid) {
    const rows = [], cols = [];
    for (let y = 0; y < N; y++) if (grid[y].every(v => v >= 0)) rows.push(y);
    for (let x = 0; x < N; x++) {
      let full = true;
      for (let y = 0; y < N; y++) if (grid[y][x] < 0) { full = false; break; }
      if (full) cols.push(x);
    }
    return { rows, cols };
  }

  /** Pontos por limpar `lines` linhas/colunas de uma vez com a sequência `streak`. */
  function lineScore(lines, streak) {
    if (lines <= 0) return 0;
    return 10 * lines * (lines + 1) / 2 * Math.min(Math.max(streak, 1), MAX_STREAK);
  }

  function randPiece(rng) {
    return {
      s: Math.floor(rng() * SHAPE_DATA.length),
      c: Math.floor(rng() * COLOR_COUNT),
    };
  }

  /** Dá 3 peças novas; tenta garantir que pelo menos uma caiba no painel. */
  function deal(state, rng = Math.random) {
    let set;
    for (let t = 0; t < 30; t++) {
      set = [randPiece(rng), randPiece(rng), randPiece(rng)];
      if (set.some(p => fitsAnywhere(state.grid, SHAPE_DATA[p.s]))) break;
    }
    state.tray = set;
    return set;
  }

  function isGameOver(state) {
    const alive = state.tray.filter(Boolean);
    return alive.length > 0 && !alive.some(p => fitsAnywhere(state.grid, SHAPE_DATA[p.s]));
  }

  /**
   * Coloca a peça `idx` da bandeja em (gx, gy). Muda `state` e devolve o que aconteceu,
   * ou null se a jogada é inválida.
   */
  function place(state, idx, gx, gy, rng = Math.random) {
    const piece = state.tray[idx];
    if (!piece || state.over) return null;
    const sd = SHAPE_DATA[piece.s];
    if (!canPlace(state.grid, sd, gx, gy)) return null;

    for (const [r, c] of sd.cells) state.grid[gy + r][gx + c] = piece.c;
    state.tray[idx] = null;

    let gained = sd.cells.length;
    const { rows, cols } = linesFor(state.grid);
    const lines = rows.length + cols.length;
    const cleared = [];
    let lines_ = 0, boardCleared = false;

    if (lines) {
      state.streak++;
      const keys = new Set();
      rows.forEach(y => { for (let x = 0; x < N; x++) keys.add(y * N + x); });
      cols.forEach(x => { for (let y = 0; y < N; y++) keys.add(y * N + x); });
      keys.forEach(k => {
        const y = Math.floor(k / N), x = k % N;
        cleared.push({ x, y, c: state.grid[y][x] });
        state.grid[y][x] = -1;
      });
      lines_ = lineScore(lines, state.streak);
      gained += lines_;
      if (state.grid.every(row => row.every(v => v < 0))) {
        boardCleared = true;
        gained += BOARD_CLEAR_BONUS;
      }
    } else {
      state.streak = 0;
    }

    state.score += gained;
    const dealt = state.tray.every(p => !p);
    if (dealt) deal(state, rng);
    state.over = isGameOver(state);

    return { gained, lineScore: lines_, rows, cols, cleared, boardCleared, dealt, streak: state.streak, over: state.over };
  }

  /** Gerador pseudoaleatório determinístico (mulberry32), útil para testes e replays. */
  function seededRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  return {
    N, COLOR_COUNT, MAX_STREAK, BOARD_CLEAR_BONUS, SHAPES, SHAPE_DATA,
    shapeCells, emptyGrid, newState, canPlace, fitsAnywhere, linesFor, lineScore,
    randPiece, deal, isGameOver, place, seededRng,
  };
});

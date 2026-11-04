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

  /** Pontuação em que a dificuldade chega ao máximo. */
  const DIFFICULTY_MAX_SCORE = 4000;

  /** 0 no início da partida, 1 a partir de DIFFICULTY_MAX_SCORE pontos. */
  function difficulty(score) {
    return Math.min(Math.max(score, 0) / DIFFICULTY_MAX_SCORE, 1);
  }

  /**
   * Peso de sorteio de uma forma. No começo vêm mais peças pequenas;
   * com a pontuação subindo, as peças grandes ficam mais comuns.
   */
  function pieceWeight(sd, score) {
    const d = difficulty(score);
    const n = sd.cells.length;
    if (n <= 2) return 4 - 3.2 * d;        // 1–2 azulejos
    if (n <= 4) return 2.5 - 0.7 * d;      // 3–4 azulejos
    if (n <= 6) return 0.5 + 2.5 * d;      // 5–6 azulejos
    return 0.1 + 1.6 * d;                  // quadrado 3x3
  }

  function randPiece(rng, score = 0) {
    const weights = SHAPE_DATA.map(sd => pieceWeight(sd, score));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng() * total, s = 0;
    while (s < weights.length - 1 && r >= weights[s]) { r -= weights[s]; s++; }
    return { s, c: Math.floor(rng() * COLOR_COUNT) };
  }

  /** Dá 3 peças novas; tenta garantir que pelo menos uma caiba no painel. */
  function deal(state, rng = Math.random) {
    let set;
    for (let t = 0; t < 30; t++) {
      set = [randPiece(rng, state.score), randPiece(rng, state.score), randPiece(rng, state.score)];
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

  /** Versão do formato salvo. Mude ao alterar a estrutura do estado. */
  const SAVE_VERSION = 1;

  function serialize(state) {
    return JSON.stringify({ v: SAVE_VERSION, grid: state.grid, tray: state.tray, score: state.score, streak: state.streak });
  }

  /** Lê uma partida salva. Devolve null se o texto estiver corrompido ou for de outra versão. */
  function restore(text) {
    let d;
    try { d = JSON.parse(text); } catch (e) { return null; }
    const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
    if (!d || d.v !== SAVE_VERSION) return null;
    if (!Array.isArray(d.grid) || d.grid.length !== N) return null;
    for (const row of d.grid) {
      if (!Array.isArray(row) || row.length !== N || !row.every(v => isInt(v, -1, COLOR_COUNT - 1))) return null;
    }
    if (!Array.isArray(d.tray) || d.tray.length !== 3) return null;
    for (const p of d.tray) {
      if (p === null) continue;
      if (!p || !isInt(p.s, 0, SHAPE_DATA.length - 1) || !isInt(p.c, 0, COLOR_COUNT - 1)) return null;
    }
    if (d.tray.every(p => p === null)) return null;
    if (!isInt(d.score, 0, Number.MAX_SAFE_INTEGER) || !isInt(d.streak, 0, Number.MAX_SAFE_INTEGER)) return null;
    if (linesFor(d.grid).rows.length || linesFor(d.grid).cols.length) return null;
    const state = { grid: d.grid, tray: d.tray, score: d.score, streak: d.streak, over: false };
    state.over = isGameOver(state);
    return state;
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
    DIFFICULTY_MAX_SCORE, SAVE_VERSION,
    shapeCells, emptyGrid, newState, canPlace, fitsAnywhere, linesFor, lineScore,
    difficulty, pieceWeight, randPiece, deal, isGameOver, place, serialize, restore, seededRng,
  };
});

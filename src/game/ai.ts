import type { Board, Color, PieceType, Position } from './types';
import { COLS, ROWS, crossedRiver } from './constants';
import { getPseudoMoves } from './moves';
import { isInCheck } from './judge';

export type Difficulty = 'beginner' | 'advanced' | 'master';

export interface AIConfig {
  depth: number;
  randomness: number;
}

export const DIFFICULTY_CONFIG: Record<Difficulty, AIConfig> = {
  beginner: { depth: 2, randomness: 60 },
  advanced: { depth: 3, randomness: 20 },
  master: { depth: 4, randomness: 0 },
};

const PIECE_VALUE: Record<PieceType, number> = {
  king: 20000,
  chariot: 900,
  horse: 400,
  cannon: 450,
  advisor: 200,
  elephant: 200,
  soldier: 100,
};

const MATE_SCORE = 100000;

const SOLDIER_PST_RED = [
  [9, 9, 9, 11, 13, 11, 9, 9, 9],
  [19, 24, 34, 42, 44, 42, 34, 24, 19],
  [19, 24, 32, 37, 37, 37, 32, 24, 19],
  [19, 23, 27, 29, 30, 29, 27, 23, 19],
  [14, 18, 20, 27, 29, 27, 20, 18, 14],
  [7, 0, 13, 0, 16, 0, 13, 0, 7],
  [7, 0, 7, 0, 15, 0, 7, 0, 7],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
];

const HORSE_PST_RED = [
  [4, 8, 16, 12, 4, 12, 16, 8, 4],
  [4, 10, 28, 16, 8, 16, 28, 10, 4],
  [12, 14, 16, 20, 18, 20, 16, 14, 12],
  [8, 24, 18, 24, 20, 24, 18, 24, 8],
  [6, 16, 14, 18, 16, 18, 14, 16, 6],
  [4, 12, 16, 14, 12, 14, 16, 12, 4],
  [2, 6, 8, 6, 10, 6, 8, 6, 2],
  [4, 2, 8, 8, 4, 8, 8, 2, 4],
  [0, 2, 4, 4, -2, 4, 4, 2, 0],
  [0, -4, 0, 0, 0, 0, 0, -4, 0],
];

const CHARIOT_PST_RED = [
  [14, 14, 12, 18, 16, 18, 12, 14, 14],
  [16, 20, 18, 24, 26, 24, 18, 20, 16],
  [12, 12, 12, 18, 18, 18, 12, 12, 12],
  [12, 18, 16, 22, 22, 22, 16, 18, 12],
  [12, 14, 12, 18, 18, 18, 12, 14, 12],
  [12, 16, 14, 20, 20, 20, 14, 16, 12],
  [6, 10, 8, 14, 14, 14, 8, 10, 6],
  [4, 8, 6, 14, 12, 14, 6, 8, 4],
  [8, 4, 8, 16, 8, 16, 8, 4, 8],
  [-2, 10, 6, 14, 12, 14, 6, 10, -2],
];

const CANNON_PST_RED = [
  [6, 4, 0, -10, -12, -10, 0, 4, 6],
  [2, 2, 0, -4, -14, -4, 0, 2, 2],
  [2, 2, 0, -10, -8, -10, 0, 2, 2],
  [0, 0, -2, 4, 10, 4, -2, 0, 0],
  [0, 0, 0, 2, 8, 2, 0, 0, 0],
  [-2, 0, 4, 2, 6, 2, 4, 0, -2],
  [0, 0, 0, 2, 4, 2, 0, 0, 0],
  [4, 0, 8, 6, 10, 6, 8, 0, 4],
  [0, 2, 4, 6, 6, 6, 4, 2, 0],
  [0, 0, 2, 6, 6, 6, 2, 0, 0],
];

const KING_PST_RED = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 1, 3, 1, 0, 0, 0],
  [0, 0, 0, 2, 6, 2, 0, 0, 0],
];

const ADVISOR_PST_RED = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 3, 0, 0, 0, 0],
  [0, 0, 0, 3, 0, 3, 0, 0, 0],
];

const ELEPHANT_PST_RED = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 2, 0, 0, 0, 2, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [2, 0, 0, 0, 3, 0, 0, 0, 2],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
];

const PST_RED: Record<PieceType, number[][]> = {
  king: KING_PST_RED,
  advisor: ADVISOR_PST_RED,
  elephant: ELEPHANT_PST_RED,
  horse: HORSE_PST_RED,
  chariot: CHARIOT_PST_RED,
  cannon: CANNON_PST_RED,
  soldier: SOLDIER_PST_RED,
};

function pstValue(type: PieceType, col: number, row: number, color: Color): number {
  const table = PST_RED[type];
  if (color === 'red') {
    return table[row][col];
  }
  return table[ROWS - 1 - row][COLS - 1 - col];
}

export function evaluate(board: Board): number {
  let score = 0;
  let redKing = false;
  let blackKing = false;

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const piece = board[row][col];
      if (!piece) continue;
      let val = PIECE_VALUE[piece.type];
      if (piece.type === 'soldier' && crossedRiver(row, piece.color)) {
        val += 50;
      }
      val += pstValue(piece.type, col, row, piece.color);
      if (piece.color === 'red') {
        score += val;
        if (piece.type === 'king') redKing = true;
      } else {
        score -= val;
        if (piece.type === 'king') blackKing = true;
      }
    }
  }

  if (!redKing) return -MATE_SCORE;
  if (!blackKing) return MATE_SCORE;
  return score;
}

interface SearchMove {
  from: Position;
  to: Position;
  captured: { type: PieceType; color: Color } | null;
}

function generateMoves(board: Board, color: Color): SearchMove[] {
  const moves: SearchMove[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const piece = board[row][col];
      if (!piece || piece.color !== color) continue;
      const from = { col, row };
      const targets = getPseudoMoves(board, from);
      for (const to of targets) {
        const target = board[to.row][to.col];
        moves.push({ from, to, captured: target ? { type: target.type, color: target.color } : null });
      }
    }
  }
  return moves;
}

function generateLegalMoves(board: Board, color: Color): SearchMove[] {
  const moves: SearchMove[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const piece = board[row][col];
      if (!piece || piece.color !== color) continue;
      const from = { col, row };
      const targets = getPseudoMoves(board, from);
      for (const to of targets) {
        const target = board[to.row][to.col];
        const move: SearchMove = { from, to, captured: target ? { type: target.type, color: target.color } : null };
        makeMove(board, move);
        const stillSafe = !isInCheck(board, color);
        unmakeMove(board, move);
        if (stillSafe) moves.push(move);
      }
    }
  }
  return moves;
}

function orderMoves(moves: SearchMove[]): SearchMove[] {
  return moves.slice().sort((a, b) => {
    const av = a.captured ? PIECE_VALUE[a.captured.type] : 0;
    const bv = b.captured ? PIECE_VALUE[b.captured.type] : 0;
    return bv - av;
  });
}

function makeMove(board: Board, move: SearchMove): void {
  board[move.to.row][move.to.col] = board[move.from.row][move.from.col];
  board[move.from.row][move.from.col] = null;
}

function unmakeMove(board: Board, move: SearchMove): void {
  board[move.from.row][move.from.col] = board[move.to.row][move.to.col];
  board[move.to.row][move.to.col] = move.captured ? { ...move.captured } : null;
}

function minimax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
): number {
  const standPat = evaluate(board);
  if (Math.abs(standPat) >= MATE_SCORE) return standPat;
  if (depth === 0) return standPat;

  const color: Color = maximizing ? 'red' : 'black';
  const moves = orderMoves(generateMoves(board, color));
  if (moves.length === 0) {
    return maximizing ? -MATE_SCORE + (10 - depth) : MATE_SCORE - (10 - depth);
  }

  if (maximizing) {
    let best = -Infinity;
    for (const move of moves) {
      makeMove(board, move);
      const val = minimax(board, depth - 1, alpha, beta, false);
      unmakeMove(board, move);
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      makeMove(board, move);
      const val = minimax(board, depth - 1, alpha, beta, true);
      unmakeMove(board, move);
      if (val < best) best = val;
      if (best < beta) beta = best;
      if (alpha >= beta) break;
    }
    return best;
  }
}

export function findBestMove(board: Board, color: Color, difficulty: Difficulty): { from: Position; to: Position } | null {
  const config = DIFFICULTY_CONFIG[difficulty];
  const maximizing = color === 'red';
  const moves = orderMoves(generateLegalMoves(board, color));
  if (moves.length === 0) return null;

  const scored: { move: SearchMove; score: number }[] = [];
  const workBoard = board.map((r) => r.map((c) => (c ? { ...c } : null)));

  for (const move of moves) {
    makeMove(workBoard, move);
    const score = minimax(workBoard, config.depth - 1, -Infinity, Infinity, !maximizing);
    unmakeMove(workBoard, move);
    scored.push({ move, score });
  }

  scored.sort((a, b) => (maximizing ? b.score - a.score : a.score - b.score));

  if (config.randomness > 0) {
    const bestScore = scored[0].score;
    const candidates = scored.filter(
      (s) => Math.abs(s.score - bestScore) <= config.randomness,
    );
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    return { from: pick.move.from, to: pick.move.to };
  }

  return { from: scored[0].move.from, to: scored[0].move.to };
}

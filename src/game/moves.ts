import type { Board, Color, Piece, Position } from './types';
import { crossedRiver, inBounds, inPalace } from './constants';

function isEnemy(piece: Piece | null, color: Color): boolean {
  return piece !== null && piece.color !== color;
}

function isEmpty(piece: Piece | null): boolean {
  return piece === null;
}

function isOwn(piece: Piece | null, color: Color): boolean {
  return piece !== null && piece.color === color;
}

function tryAdd(
  board: Board,
  from: Position,
  col: number,
  row: number,
  color: Color,
  moves: Position[],
): void {
  if (!inBounds(col, row)) return;
  const target = board[row][col];
  if (isOwn(target, color)) return;
  moves.push({ col, row });
}

function kingMoves(board: Board, from: Position, color: Color): Position[] {
  const moves: Position[] = [];
  const deltas = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];
  for (const [dc, dr] of deltas) {
    const nc = from.col + dc;
    const nr = from.row + dr;
    if (!inPalace(nc, nr, color)) continue;
    tryAdd(board, from, nc, nr, color, moves);
  }
  return moves;
}

function advisorMoves(board: Board, from: Position, color: Color): Position[] {
  const moves: Position[] = [];
  const deltas = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  for (const [dc, dr] of deltas) {
    const nc = from.col + dc;
    const nr = from.row + dr;
    if (!inPalace(nc, nr, color)) continue;
    tryAdd(board, from, nc, nr, color, moves);
  }
  return moves;
}

function elephantMoves(board: Board, from: Position, color: Color): Position[] {
  const moves: Position[] = [];
  const deltas = [
    [2, 2],
    [2, -2],
    [-2, 2],
    [-2, -2],
  ];
  for (const [dc, dr] of deltas) {
    const nc = from.col + dc;
    const nr = from.row + dr;
    if (!inBounds(nc, nr)) continue;
    if (color === 'red' && nr > 4) continue;
    if (color === 'black' && nr < 5) continue;
    const eyeCol = from.col + dc / 2;
    const eyeRow = from.row + dr / 2;
    if (!isEmpty(board[eyeRow][eyeCol])) continue;
    tryAdd(board, from, nc, nr, color, moves);
  }
  return moves;
}

function horseMoves(board: Board, from: Position, color: Color): Position[] {
  const moves: Position[] = [];
  const candidates = [
    { leg: [0, 1], dest: [1, 2] },
    { leg: [0, 1], dest: [-1, 2] },
    { leg: [0, -1], dest: [1, -2] },
    { leg: [0, -1], dest: [-1, -2] },
    { leg: [1, 0], dest: [2, 1] },
    { leg: [1, 0], dest: [2, -1] },
    { leg: [-1, 0], dest: [-2, 1] },
    { leg: [-1, 0], dest: [-2, -1] },
  ];
  for (const { leg, dest } of candidates) {
    const legCol = from.col + leg[0];
    const legRow = from.row + leg[1];
    if (!inBounds(legCol, legRow)) continue;
    if (!isEmpty(board[legRow][legCol])) continue;
    const nc = from.col + dest[0];
    const nr = from.row + dest[1];
    tryAdd(board, from, nc, nr, color, moves);
  }
  return moves;
}

function chariotMoves(board: Board, from: Position, color: Color): Position[] {
  const moves: Position[] = [];
  const dirs = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];
  for (const [dc, dr] of dirs) {
    let nc = from.col + dc;
    let nr = from.row + dr;
    while (inBounds(nc, nr)) {
      const target = board[nr][nc];
      if (isEmpty(target)) {
        moves.push({ col: nc, row: nr });
      } else {
        if (isEnemy(target, color)) moves.push({ col: nc, row: nr });
        break;
      }
      nc += dc;
      nr += dr;
    }
  }
  return moves;
}

function cannonMoves(board: Board, from: Position, color: Color): Position[] {
  const moves: Position[] = [];
  const dirs = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];
  for (const [dc, dr] of dirs) {
    let nc = from.col + dc;
    let nr = from.row + dr;
    while (inBounds(nc, nr) && isEmpty(board[nr][nc])) {
      moves.push({ col: nc, row: nr });
      nc += dc;
      nr += dr;
    }
    if (!inBounds(nc, nr)) continue;
    nc += dc;
    nr += dr;
    while (inBounds(nc, nr)) {
      const target = board[nr][nc];
      if (!isEmpty(target)) {
        if (isEnemy(target, color)) moves.push({ col: nc, row: nr });
        break;
      }
      nc += dc;
      nr += dr;
    }
  }
  return moves;
}

function soldierMoves(board: Board, from: Position, color: Color): Position[] {
  const moves: Position[] = [];
  const forward = color === 'red' ? 1 : -1;
  const fr = from.row + forward;
  if (inBounds(from.col, fr)) {
    tryAdd(board, from, from.col, fr, color, moves);
  }
  if (crossedRiver(from.row, color)) {
    tryAdd(board, from, from.col - 1, from.row, color, moves);
    tryAdd(board, from, from.col + 1, from.row, color, moves);
  }
  return moves;
}

export function getPseudoMoves(board: Board, from: Position): Position[] {
  const piece = board[from.row][from.col];
  if (!piece) return [];
  switch (piece.type) {
    case 'king':
      return kingMoves(board, from, piece.color);
    case 'advisor':
      return advisorMoves(board, from, piece.color);
    case 'elephant':
      return elephantMoves(board, from, piece.color);
    case 'horse':
      return horseMoves(board, from, piece.color);
    case 'chariot':
      return chariotMoves(board, from, piece.color);
    case 'cannon':
      return cannonMoves(board, from, piece.color);
    case 'soldier':
      return soldierMoves(board, from, piece.color);
    default:
      return [];
  }
}

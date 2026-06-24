import type { Board, Color } from './types';
import { COLS, ROWS, findKing } from './constants';
import { getPseudoMoves } from './moves';

export function kingsFacing(board: Board, color: Color): boolean {
  const myKing = findKing(board, color);
  const enemyKing = findKing(board, color === 'red' ? 'black' : 'red');
  if (!myKing || !enemyKing) return false;
  if (myKing.col !== enemyKing.col) return false;
  const col = myKing.col;
  const lo = Math.min(myKing.row, enemyKing.row);
  const hi = Math.max(myKing.row, enemyKing.row);
  for (let r = lo + 1; r < hi; r++) {
    if (board[r][col] !== null) return false;
  }
  return true;
}

export function isInCheck(board: Board, color: Color): boolean {
  const myKing = findKing(board, color);
  if (!myKing) return true;

  if (kingsFacing(board, color)) return true;

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const piece = board[row][col];
      if (!piece || piece.color === color) continue;
      const moves = getPseudoMoves(board, { col, row });
      for (const m of moves) {
        if (m.col === myKing.col && m.row === myKing.row) return true;
      }
    }
  }
  return false;
}

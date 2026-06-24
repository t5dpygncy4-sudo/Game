import type { Board, Color, GameStatus, Position } from './types';
import { cloneBoard } from './constants';
import { getPseudoMoves } from './moves';
import { isInCheck } from './judge';

export function getLegalMoves(board: Board, from: Position): Position[] {
  const piece = board[from.row][from.col];
  if (!piece) return [];
  const pseudo = getPseudoMoves(board, from);
  return pseudo.filter((to) => {
    const next = cloneBoard(board);
    next[to.row][to.col] = next[from.row][from.col];
    next[from.row][from.col] = null;
    return !isInCheck(next, piece.color);
  });
}

export function hasAnyLegalMove(board: Board, color: Color): boolean {
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const piece = board[row][col];
      if (!piece || piece.color !== color) continue;
      if (getLegalMoves(board, { col, row }).length > 0) return true;
    }
  }
  return false;
}

export function getGameStatus(board: Board, turn: Color): GameStatus {
  const inCheck = isInCheck(board, turn);
  const hasMove = hasAnyLegalMove(board, turn);
  if (!hasMove) {
    return turn === 'red' ? 'blackWin' : 'redWin';
  }
  return inCheck ? 'check' : 'playing';
}

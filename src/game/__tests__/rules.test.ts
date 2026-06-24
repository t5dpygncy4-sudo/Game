import { describe, it, expect } from 'vitest';
import type { Board, Color, Piece, PieceType, Position } from '../types';
import { COLS, ROWS, cloneBoard, createInitialBoard, findKing } from '../constants';
import { getPseudoMoves } from '../moves';
import { isInCheck, kingsFacing } from '../judge';
import { getLegalMoves, getGameStatus, hasAnyLegalMove } from '../validate';
import { getNotation } from '../notation';

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => null as Piece | null),
  );
}

function place(board: Board, col: number, row: number, type: PieceType, color: Color): void {
  board[row][col] = { type, color };
}

function pos(col: number, row: number): Position {
  return { col, row };
}

function hasMove(moves: Position[], col: number, row: number): boolean {
  return moves.some((m) => m.col === col && m.row === row);
}

describe('初始局面', () => {
  it('应有 32 枚棋子', () => {
    const board = createInitialBoard();
    let count = 0;
    for (const row of board) for (const cell of row) if (cell) count++;
    expect(count).toBe(32);
  });

  it('红帅在 (4,0)，黑将在 (4,9)', () => {
    const board = createInitialBoard();
    expect(board[0][4]?.type).toBe('king');
    expect(board[0][4]?.color).toBe('red');
    expect(board[9][4]?.type).toBe('king');
    expect(board[9][4]?.color).toBe('black');
  });

  it('初始局面双方均未被将军且可走', () => {
    const board = createInitialBoard();
    expect(isInCheck(board, 'red')).toBe(false);
    expect(isInCheck(board, 'black')).toBe(false);
    expect(getGameStatus(board, 'red')).toBe('playing');
  });
});

describe('车', () => {
  it('直线滑动至遇子止，可吃敌子', () => {
    const board = emptyBoard();
    place(board, 4, 4, 'chariot', 'red');
    place(board, 4, 7, 'soldier', 'black');
    const moves = getPseudoMoves(board, pos(4, 4));
    expect(hasMove(moves, 4, 5)).toBe(true);
    expect(hasMove(moves, 4, 7)).toBe(true);
    expect(hasMove(moves, 4, 8)).toBe(false);
  });
});

describe('炮', () => {
  it('不吃子时同车，吃子须翻越一子', () => {
    const board = emptyBoard();
    place(board, 4, 4, 'cannon', 'red');
    place(board, 4, 6, 'soldier', 'red');
    place(board, 4, 8, 'soldier', 'black');
    const moves = getPseudoMoves(board, pos(4, 4));
    expect(hasMove(moves, 4, 5)).toBe(true);
    expect(hasMove(moves, 4, 6)).toBe(false);
    expect(hasMove(moves, 4, 7)).toBe(false);
    expect(hasMove(moves, 4, 8)).toBe(true);
  });
});

describe('马', () => {
  it('走日字，蹩马腿不可走', () => {
    const board = emptyBoard();
    place(board, 4, 4, 'horse', 'red');
    const moves = getPseudoMoves(board, pos(4, 4));
    expect(hasMove(moves, 5, 6)).toBe(true);
    expect(hasMove(moves, 6, 5)).toBe(true);

    const board2 = emptyBoard();
    place(board2, 4, 4, 'horse', 'red');
    place(board2, 4, 5, 'soldier', 'red');
    const moves2 = getPseudoMoves(board2, pos(4, 4));
    expect(hasMove(moves2, 5, 6)).toBe(false);
    expect(hasMove(moves2, 3, 6)).toBe(false);
  });
});

describe('象', () => {
  it('走田字，塞象眼不可走，不可过河', () => {
    const board = emptyBoard();
    place(board, 4, 2, 'elephant', 'red');
    const moves = getPseudoMoves(board, pos(4, 2));
    expect(hasMove(moves, 6, 4)).toBe(true);
    expect(hasMove(moves, 6, 0)).toBe(true);

    const board2 = emptyBoard();
    place(board2, 4, 2, 'elephant', 'red');
    place(board2, 5, 3, 'soldier', 'red');
    const moves2 = getPseudoMoves(board2, pos(4, 2));
    expect(hasMove(moves2, 6, 4)).toBe(false);
  });
});

describe('士', () => {
  it('九宫内斜走一步', () => {
    const board = emptyBoard();
    place(board, 4, 0, 'advisor', 'red');
    const moves = getPseudoMoves(board, pos(4, 0));
    expect(hasMove(moves, 3, 1)).toBe(true);
    expect(hasMove(moves, 5, 1)).toBe(true);
    expect(moves.length).toBe(2);
  });
});

describe('帅/将', () => {
  it('九宫内横竖一步', () => {
    const board = emptyBoard();
    place(board, 4, 1, 'king', 'red');
    const moves = getPseudoMoves(board, pos(4, 1));
    expect(hasMove(moves, 4, 0)).toBe(true);
    expect(hasMove(moves, 4, 2)).toBe(true);
    expect(hasMove(moves, 3, 1)).toBe(true);
    expect(hasMove(moves, 5, 1)).toBe(true);
    expect(moves.length).toBe(4);
  });

  it('飞将：双将同列无子相隔', () => {
    const board = emptyBoard();
    place(board, 4, 0, 'king', 'red');
    place(board, 4, 9, 'king', 'black');
    expect(kingsFacing(board, 'red')).toBe(true);
    expect(isInCheck(board, 'red')).toBe(true);
  });

  it('飞将：中间有子则不相隔', () => {
    const board = emptyBoard();
    place(board, 4, 0, 'king', 'red');
    place(board, 4, 9, 'king', 'black');
    place(board, 4, 5, 'soldier', 'red');
    expect(kingsFacing(board, 'red')).toBe(false);
  });
});

describe('兵/卒', () => {
  it('未过河只能向前', () => {
    const board = emptyBoard();
    place(board, 4, 3, 'soldier', 'red');
    const moves = getPseudoMoves(board, pos(4, 3));
    expect(hasMove(moves, 4, 4)).toBe(true);
    expect(hasMove(moves, 3, 3)).toBe(false);
    expect(hasMove(moves, 5, 3)).toBe(false);
  });

  it('过河后可左右向前，不可后退', () => {
    const board = emptyBoard();
    place(board, 4, 5, 'soldier', 'red');
    const moves = getPseudoMoves(board, pos(4, 5));
    expect(hasMove(moves, 4, 6)).toBe(true);
    expect(hasMove(moves, 3, 5)).toBe(true);
    expect(hasMove(moves, 5, 5)).toBe(true);
    expect(hasMove(moves, 4, 4)).toBe(false);
  });
});

describe('送将禁止', () => {
  it('不能走出使己方将被攻击的着法', () => {
    const board = emptyBoard();
    place(board, 4, 0, 'king', 'red');
    place(board, 0, 9, 'king', 'black');
    place(board, 4, 5, 'chariot', 'black');
    const moves = getLegalMoves(board, pos(4, 0));
    expect(hasMove(moves, 4, 1)).toBe(false);
    expect(hasMove(moves, 3, 0)).toBe(true);
    expect(hasMove(moves, 5, 0)).toBe(true);
  });
});

describe('将死', () => {
  it('被将军且无解将走法判负', () => {
    const board = emptyBoard();
    place(board, 4, 0, 'king', 'red');
    place(board, 0, 9, 'king', 'black');
    place(board, 3, 2, 'chariot', 'black');
    place(board, 4, 2, 'chariot', 'black');
    place(board, 5, 2, 'chariot', 'black');
    expect(isInCheck(board, 'red')).toBe(true);
    expect(hasAnyLegalMove(board, 'red')).toBe(false);
    expect(getGameStatus(board, 'red')).toBe('blackWin');
  });
});

describe('困毙', () => {
  it('未被将军但无合法走法判负', () => {
    const board = emptyBoard();
    place(board, 4, 0, 'king', 'red');
    place(board, 0, 9, 'king', 'black');
    place(board, 2, 2, 'horse', 'black');
    place(board, 5, 1, 'chariot', 'black');
    expect(isInCheck(board, 'red')).toBe(false);
    expect(hasAnyLegalMove(board, 'red')).toBe(false);
    expect(getGameStatus(board, 'red')).toBe('blackWin');
  });
});

describe('记谱', () => {
  it('红方炮二平五', () => {
    const board = createInitialBoard();
    const notation = getNotation(board, pos(7, 2), pos(4, 2), { type: 'cannon', color: 'red' });
    expect(notation).toBe('炮二平五');
  });

  it('黑方马8进7', () => {
    const board = createInitialBoard();
    const notation = getNotation(board, pos(7, 9), pos(6, 7), { type: 'horse', color: 'black' });
    expect(notation).toBe('马8进7');
  });
});

describe('cloneBoard', () => {
  it('深拷贝不互相影响', () => {
    const board = createInitialBoard();
    const copy = cloneBoard(board);
    copy[0][0] = null;
    expect(board[0][0]).not.toBeNull();
  });
});

describe('findKing', () => {
  it('找到指定方将的位置', () => {
    const board = createInitialBoard();
    expect(findKing(board, 'red')).toEqual({ col: 4, row: 0 });
    expect(findKing(board, 'black')).toEqual({ col: 4, row: 9 });
  });
});

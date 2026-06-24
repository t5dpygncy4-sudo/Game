import type { Board, Color, Piece, PieceType } from './types';

export const COLS = 9;
export const ROWS = 10;

export const RED_PALACE = { colMin: 3, colMax: 5, rowMin: 0, rowMax: 2 };
export const BLACK_PALACE = { colMin: 3, colMax: 5, rowMin: 7, rowMax: 9 };

export const RED_RIVER_ROW = 4;
export const BLACK_RIVER_ROW = 5;

export const PIECE_CHARS: Record<Color, Record<PieceType, string>> = {
  red: {
    king: '帅',
    advisor: '仕',
    elephant: '相',
    horse: '马',
    chariot: '车',
    cannon: '炮',
    soldier: '兵',
  },
  black: {
    king: '将',
    advisor: '士',
    elephant: '象',
    horse: '马',
    chariot: '车',
    cannon: '炮',
    soldier: '卒',
  },
};

export const PIECE_NAMES: Record<PieceType, string> = {
  king: '将帅',
  advisor: '士仕',
  elephant: '象相',
  horse: '马',
  chariot: '车',
  cannon: '炮',
  soldier: '兵卒',
};

export const NOTATION_CHARS: Record<Color, Record<PieceType, string>> = {
  red: {
    king: '帅',
    advisor: '仕',
    elephant: '相',
    horse: '马',
    chariot: '车',
    cannon: '炮',
    soldier: '兵',
  },
  black: {
    king: '将',
    advisor: '士',
    elephant: '象',
    horse: '马',
    chariot: '车',
    cannon: '炮',
    soldier: '卒',
  },
};

function p(type: PieceType, color: Color): Piece {
  return { type, color };
}

export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => null as Piece | null),
  );

  board[0][0] = p('chariot', 'red');
  board[0][1] = p('horse', 'red');
  board[0][2] = p('elephant', 'red');
  board[0][3] = p('advisor', 'red');
  board[0][4] = p('king', 'red');
  board[0][5] = p('advisor', 'red');
  board[0][6] = p('elephant', 'red');
  board[0][7] = p('horse', 'red');
  board[0][8] = p('chariot', 'red');
  board[2][1] = p('cannon', 'red');
  board[2][7] = p('cannon', 'red');
  board[3][0] = p('soldier', 'red');
  board[3][2] = p('soldier', 'red');
  board[3][4] = p('soldier', 'red');
  board[3][6] = p('soldier', 'red');
  board[3][8] = p('soldier', 'red');

  board[9][0] = p('chariot', 'black');
  board[9][1] = p('horse', 'black');
  board[9][2] = p('elephant', 'black');
  board[9][3] = p('advisor', 'black');
  board[9][4] = p('king', 'black');
  board[9][5] = p('advisor', 'black');
  board[9][6] = p('elephant', 'black');
  board[9][7] = p('horse', 'black');
  board[9][8] = p('chariot', 'black');
  board[7][1] = p('cannon', 'black');
  board[7][7] = p('cannon', 'black');
  board[6][0] = p('soldier', 'black');
  board[6][2] = p('soldier', 'black');
  board[6][4] = p('soldier', 'black');
  board[6][6] = p('soldier', 'black');
  board[6][8] = p('soldier', 'black');

  return board;
}

export function inBounds(col: number, row: number): boolean {
  return col >= 0 && col < COLS && row >= 0 && row < ROWS;
}

export function inPalace(col: number, row: number, color: Color): boolean {
  const palace = color === 'red' ? RED_PALACE : BLACK_PALACE;
  return (
    col >= palace.colMin &&
    col <= palace.colMax &&
    row >= palace.rowMin &&
    row <= palace.rowMax
  );
}

export function crossedRiver(row: number, color: Color): boolean {
  return color === 'red' ? row >= BLACK_RIVER_ROW : row <= RED_RIVER_ROW;
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

export function findKing(board: Board, color: Color): { col: number; row: number } | null {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const piece = board[row][col];
      if (piece && piece.type === 'king' && piece.color === color) {
        return { col, row };
      }
    }
  }
  return null;
}

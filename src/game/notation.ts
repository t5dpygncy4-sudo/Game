import type { Board, Color, Piece, PieceType, Position } from './types';
import { NOTATION_CHARS, ROWS } from './constants';

const RED_NUMS = ['九', '八', '七', '六', '五', '四', '三', '二', '一'];
const BLACK_NUMS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

function colNum(col: number, color: Color): string {
  return color === 'red' ? RED_NUMS[col] : BLACK_NUMS[col];
}

function stepNum(steps: number, color: Color): string {
  return color === 'red' ? RED_NUMS[9 - steps] : String(steps);
}

function isStraightMover(type: PieceType): boolean {
  return type === 'chariot' || type === 'cannon' || type === 'king' || type === 'soldier';
}

export function getNotation(board: Board, from: Position, to: Position, piece: Piece): string {
  const { type, color } = piece;
  const char = NOTATION_CHARS[color][type];

  const samePieces: Position[] = [];
  for (let r = 0; r < ROWS; r++) {
    const p = board[r][from.col];
    if (p && p.type === type && p.color === color) {
      samePieces.push({ col: from.col, row: r });
    }
  }
  samePieces.sort((a, b) => a.row - b.row);
  const idx = samePieces.findIndex((p) => p.row === from.row);

  let fromId: string;
  if (samePieces.length >= 2) {
    if (samePieces.length >= 3) {
      if (color === 'red') {
        fromId = idx === samePieces.length - 1 ? '前' : idx === 0 ? '后' : '中';
      } else {
        fromId = idx === 0 ? '前' : idx === samePieces.length - 1 ? '后' : '中';
      }
    } else if (color === 'red') {
      fromId = idx === samePieces.length - 1 ? '前' : '后';
    } else {
      fromId = idx === 0 ? '前' : '后';
    }
  } else {
    fromId = colNum(from.col, color);
  }

  let action: string;
  let target: string;
  if (to.row === from.row) {
    action = '平';
    target = colNum(to.col, color);
  } else {
    const advancing = color === 'red' ? to.row > from.row : to.row < from.row;
    action = advancing ? '进' : '退';
    if (isStraightMover(type)) {
      target = stepNum(Math.abs(to.row - from.row), color);
    } else {
      target = colNum(to.col, color);
    }
  }

  return `${char}${fromId}${action}${target}`;
}

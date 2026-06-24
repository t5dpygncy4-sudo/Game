export type Color = 'red' | 'black';

export type PieceType =
  | 'king'
  | 'advisor'
  | 'elephant'
  | 'horse'
  | 'chariot'
  | 'cannon'
  | 'soldier';

export interface Piece {
  type: PieceType;
  color: Color;
}

export interface Position {
  col: number;
  row: number;
}

export interface Move {
  from: Position;
  to: Position;
  piece: Piece;
  captured?: Piece;
  notation: string;
}

export type Board = (Piece | null)[][];

export type GameStatus = 'playing' | 'check' | 'redWin' | 'blackWin';

export interface GameState {
  board: Board;
  turn: Color;
  history: Move[];
  selected: Position | null;
  legalMoves: Position[];
  status: GameStatus;
  lastMove: Move | null;
  flipped: boolean;
}

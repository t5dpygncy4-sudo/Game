import { create } from 'zustand';
import type { Board, Color, GameStatus, Move, Position } from '@/game/types';
import { cloneBoard, createInitialBoard } from '@/game/constants';
import { getGameStatus, getLegalMoves } from '@/game/validate';
import { getNotation } from '@/game/notation';

interface GameStore {
  board: Board;
  turn: Color;
  history: Move[];
  selected: Position | null;
  legalMoves: Position[];
  status: GameStatus;
  lastMove: Move | null;
  flipped: boolean;
  onCellClick: (pos: Position) => void;
  undo: () => void;
  newGame: () => void;
  flipBoard: () => void;
}

function freshStatus(board: Board, turn: Color): GameStatus {
  return getGameStatus(board, turn);
}

export const useGameStore = create<GameStore>((set, get) => ({
  board: createInitialBoard(),
  turn: 'red',
  history: [],
  selected: null,
  legalMoves: [],
  status: 'playing',
  lastMove: null,
  flipped: false,

  onCellClick: (pos) => {
    const state = get();
    if (state.status === 'redWin' || state.status === 'blackWin') return;

    const { board, selected, legalMoves, turn } = state;
    const piece = board[pos.row][pos.col];

    if (selected) {
      if (selected.col === pos.col && selected.row === pos.row) {
        set({ selected: null, legalMoves: [] });
        return;
      }
      if (piece && piece.color === turn) {
        const moves = getLegalMoves(board, pos);
        set({ selected: pos, legalMoves: moves });
        return;
      }
      const legal = legalMoves.some((m) => m.col === pos.col && m.row === pos.row);
      if (!legal) {
        set({ selected: null, legalMoves: [] });
        return;
      }

      const movingPiece = board[selected.row][selected.col]!;
      const captured = board[pos.row][pos.col] ?? undefined;
      const notation = getNotation(board, selected, pos, movingPiece);

      const nextBoard = cloneBoard(board);
      nextBoard[pos.row][pos.col] = nextBoard[selected.row][selected.col];
      nextBoard[selected.row][selected.col] = null;

      const nextTurn: Color = turn === 'red' ? 'black' : 'red';
      const status = freshStatus(nextBoard, nextTurn);
      const move: Move = { from: selected, to: pos, piece: movingPiece, captured, notation };

      set({
        board: nextBoard,
        turn: nextTurn,
        history: [...state.history, move],
        selected: null,
        legalMoves: [],
        status,
        lastMove: move,
      });
      return;
    }

    if (piece && piece.color === turn) {
      const moves = getLegalMoves(board, pos);
      set({ selected: pos, legalMoves: moves });
    }
  },

  undo: () => {
    const state = get();
    if (state.history.length === 0) return;
    if (state.status === 'redWin' || state.status === 'blackWin') {
      // allow undo to resume from a finished game
    }
    const lastMove = state.history[state.history.length - 1];
    const board = cloneBoard(state.board);
    board[lastMove.from.row][lastMove.from.col] = board[lastMove.to.row][lastMove.to.col];
    board[lastMove.to.row][lastMove.to.col] = lastMove.captured ?? null;

    const turn: Color = lastMove.piece.color;
    const history = state.history.slice(0, -1);
    const prevMove = history.length > 0 ? history[history.length - 1] : null;
    const status = freshStatus(board, turn);

    set({
      board,
      turn,
      history,
      selected: null,
      legalMoves: [],
      status,
      lastMove: prevMove,
    });
  },

  newGame: () => {
    set({
      board: createInitialBoard(),
      turn: 'red',
      history: [],
      selected: null,
      legalMoves: [],
      status: 'playing',
      lastMove: null,
    });
  },

  flipBoard: () => {
    set((state) => ({ flipped: !state.flipped }));
  },
}));

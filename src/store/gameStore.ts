import { create } from 'zustand';
import type { Board, Color, GameStatus, Move, Position } from '@/game/types';
import { cloneBoard, createInitialBoard } from '@/game/constants';
import { getGameStatus, getLegalMoves } from '@/game/validate';
import { getNotation } from '@/game/notation';
import { findBestMove, type Difficulty } from '@/game/ai';
import { playSound, setMuted as setSoundMuted, type SoundType } from '@/lib/sound';

export type GameMode = 'pvp' | 'pve';

interface GameStore {
  board: Board;
  turn: Color;
  history: Move[];
  selected: Position | null;
  legalMoves: Position[];
  status: GameStatus;
  lastMove: Move | null;
  flipped: boolean;
  mode: GameMode;
  difficulty: Difficulty;
  aiThinking: boolean;
  muted: boolean;
  onCellClick: (pos: Position) => void;
  undo: () => void;
  newGame: () => void;
  flipBoard: () => void;
  setMode: (mode: GameMode) => void;
  setDifficulty: (d: Difficulty) => void;
  toggleMute: () => void;
  requestAIMove: () => void;
}

function freshStatus(board: Board, turn: Color): GameStatus {
  return getGameStatus(board, turn);
}

function applyMoveInternal(
  state: GameStore,
  from: Position,
  to: Position,
): Partial<GameStore> | null {
  const { board, turn, history } = state;
  const movingPiece = board[from.row][from.col];
  if (!movingPiece) return null;
  const captured = board[to.row][to.col] ?? undefined;
  const notation = getNotation(board, from, to, movingPiece);

  const nextBoard = cloneBoard(board);
  nextBoard[to.row][to.col] = nextBoard[from.row][from.col];
  nextBoard[from.row][from.col] = null;

  const nextTurn: Color = turn === 'red' ? 'black' : 'red';
  const status = freshStatus(nextBoard, nextTurn);
  const move: Move = { from, to, piece: movingPiece, captured, notation };

  let sound: SoundType = captured ? 'capture' : 'move';
  if (status === 'redWin' || status === 'blackWin') {
    const humanWon = state.mode === 'pve' ? status === 'redWin' : false;
    sound = state.mode === 'pve' ? (humanWon ? 'win' : 'lose') : 'win';
  } else if (status === 'check') {
    sound = 'check';
  }
  playSound(sound);

  return {
    board: nextBoard,
    turn: nextTurn,
    history: [...history, move],
    selected: null,
    legalMoves: [],
    status,
    lastMove: move,
  };
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
  mode: 'pvp',
  difficulty: 'advanced',
  aiThinking: false,
  muted: false,

  onCellClick: (pos) => {
    const state = get();
    if (state.status === 'redWin' || state.status === 'blackWin') return;
    if (state.aiThinking) return;
    if (state.mode === 'pve' && state.turn === 'black') return;

    const { board, selected, legalMoves, turn } = state;
    const piece = board[pos.row][pos.col];

    if (selected) {
      if (selected.col === pos.col && selected.row === pos.row) {
        set({ selected: null, legalMoves: [] });
        return;
      }
      if (piece && piece.color === turn) {
        const moves = getLegalMoves(board, pos);
        playSound('select');
        set({ selected: pos, legalMoves: moves });
        return;
      }
      const legal = legalMoves.some((m) => m.col === pos.col && m.row === pos.row);
      if (!legal) {
        playSound('illegal');
        set({ selected: null, legalMoves: [] });
        return;
      }

      const result = applyMoveInternal(state, selected, pos);
      if (result) set(result);
      return;
    }

    if (piece && piece.color === turn) {
      const moves = getLegalMoves(board, pos);
      playSound('select');
      set({ selected: pos, legalMoves: moves });
    }
  },

  undo: () => {
    const state = get();
    if (state.aiThinking) return;
    if (state.history.length === 0) return;

    const steps = state.mode === 'pve' && state.history.length >= 2 ? 2 : 1;
    const board = cloneBoard(state.board);
    let history = state.history.slice();
    let lastMove: Move | null = null;

    for (let i = 0; i < steps; i++) {
      if (history.length === 0) break;
      const m = history[history.length - 1];
      board[m.from.row][m.from.col] = board[m.to.row][m.to.col];
      board[m.to.row][m.to.col] = m.captured ?? null;
      history = history.slice(0, -1);
    }
    lastMove = history.length > 0 ? history[history.length - 1] : null;
    const turn: Color = history.length > 0 ? history[history.length - 1].piece.color === 'red' ? 'black' : 'red' : 'red';
    const status = freshStatus(board, turn);

    set({
      board,
      turn,
      history,
      selected: null,
      legalMoves: [],
      status,
      lastMove,
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
      aiThinking: false,
    });
  },

  flipBoard: () => {
    set((state) => ({ flipped: !state.flipped }));
  },

  setMode: (mode) => {
    set({
      mode,
      board: createInitialBoard(),
      turn: 'red',
      history: [],
      selected: null,
      legalMoves: [],
      status: 'playing',
      lastMove: null,
      aiThinking: false,
    });
  },

  setDifficulty: (difficulty) => {
    set({ difficulty });
  },

  toggleMute: () => {
    const next = !get().muted;
    setSoundMuted(next);
    set({ muted: next });
  },

  requestAIMove: () => {
    const state = get();
    if (state.mode !== 'pve') return;
    if (state.turn !== 'black') return;
    if (state.status === 'redWin' || state.status === 'blackWin') return;
    if (state.aiThinking) return;

    set({ aiThinking: true, selected: null, legalMoves: [] });

    setTimeout(() => {
      const current = get();
      if (current.turn !== 'black' || current.mode !== 'pve') {
        set({ aiThinking: false });
        return;
      }
      const best = findBestMove(current.board, 'black', current.difficulty);
      if (!best) {
        playSound('win');
        set({ aiThinking: false, status: 'redWin', selected: null, legalMoves: [] });
        return;
      }
      const result = applyMoveInternal(current, best.from, best.to);
      if (result) {
        set({ ...result, aiThinking: false });
      } else {
        set({ aiThinking: false });
      }
    }, 280);
  },
}));

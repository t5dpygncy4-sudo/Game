import { create } from 'zustand';
import type { Board, Color, GameStatus, Move, Position } from '@/game/types';
import { cloneBoard, createInitialBoard } from '@/game/constants';
import { getGameStatus, getLegalMoves } from '@/game/validate';
import { getNotation } from '@/game/notation';
import {
  aiSelfPlay,
  findBestMove,
  setPieceWeights,
  type Difficulty,
  type AIBattleMove,
  type MoveHistoryEntry,
} from '@/game/ai';
import {
  applyLearnedWeights,
  createOpeningBookProvider,
  learnFromGame,
  loadLearningState,
  resetLearningState,
  type LearningState,
} from '@/game/learning';
import { playSound, setMuted as setSoundMuted, type SoundType } from '@/lib/sound';
import { isInCheck } from '@/game/judge';

export type GameMode = 'pvp' | 'pve' | 'aiva';

export interface BattleLogEntry {
  index: number;
  winner: Color | 'draw';
  moves: number;
  reason: string;
}

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
  playerColor: Color;
  difficulty: Difficulty;
  aiThinking: boolean;
  muted: boolean;
  // 学习系统
  learning: LearningState;
  // 批量训练
  batchRunning: boolean;
  batchTotal: number;
  batchDone: number;
  batchLog: BattleLogEntry[];
  onCellClick: (pos: Position) => void;
  undo: () => void;
  newGame: () => void;
  flipBoard: () => void;
  setMode: (mode: GameMode) => void;
  setPlayerColor: (c: Color) => void;
  setDifficulty: (d: Difficulty) => void;
  toggleMute: () => void;
  requestAIMove: () => void;
  // 学习系统动作
  runSelfPlayBatch: (count: number, difficulty?: Difficulty) => void;
  stopBatch: () => void;
  resetLearning: () => void;
}

function freshStatus(board: Board, turn: Color): GameStatus {
  return getGameStatus(board, turn);
}

function applyMoveInternal(
  state: GameStore,
  from: Position,
  to: Position,
): Partial<GameStore> | null {
  const { board, turn, history, mode, playerColor } = state;
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
    if (mode === 'pve') {
      const humanWon = (status === 'redWin' && playerColor === 'red') || (status === 'blackWin' && playerColor === 'black');
      sound = humanWon ? 'win' : 'lose';
    } else {
      sound = 'win';
    }
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

// 从历史记录重建 AIBattleResult，用于学习
function buildBattleResultFromHistory(
  history: Move[],
  status: GameStatus,
): { winner: Color | 'draw'; moves: AIBattleMove[]; reason: string; finalBoard: Board } {
  let board: Board = createInitialBoard();
  const moves: AIBattleMove[] = [];
  for (const m of history) {
    const movingPiece = board[m.from.row][m.from.col];
    if (!movingPiece) break;
    const captured = board[m.to.row][m.to.col] ?? undefined;
    moves.push({
      from: m.from,
      to: m.to,
      piece: { type: movingPiece.type, color: movingPiece.color },
      captured: captured ? { type: captured.type, color: captured.color } : undefined,
      notation: m.notation,
    });
    const next = cloneBoard(board);
    next[m.to.row][m.to.col] = next[m.from.row][m.from.col];
    next[m.from.row][m.from.col] = null;
    board = next;
  }
  let winner: Color | 'draw' = 'draw';
  let reason = '对局结束';
  if (status === 'redWin') {
    winner = 'red';
    reason = '黑方被将死';
  } else if (status === 'blackWin') {
    winner = 'black';
    reason = '红方被将死';
  }
  return { winner, moves, reason, finalBoard: board };
}

// 从历史记录构建将军历史，用于 AI 检测连续将军
function buildCheckHistory(history: Move[]): MoveHistoryEntry[] {
  const entries: MoveHistoryEntry[] = [];
  let board: Board = createInitialBoard();
  for (const m of history) {
    const piece = board[m.from.row][m.from.col];
    if (!piece) break;
    // 模拟走子
    const next = cloneBoard(board);
    next[m.to.row][m.to.col] = piece;
    next[m.from.row][m.from.col] = null;
    // 走完后检测对方是否被将军
    const oppColor: Color = piece.color === 'red' ? 'black' : 'red';
    const isCheck = isInCheck(next, oppColor);
    entries.push({
      from: m.from,
      to: m.to,
      color: piece.color,
      isCheck,
      pieceType: piece.type,
    });
    board = next;
  }
  return entries;
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
  playerColor: 'red',
  difficulty: 'advanced',
  aiThinking: false,
  muted: false,
  learning: loadLearningState(),
  batchRunning: false,
  batchTotal: 0,
  batchDone: 0,
  batchLog: [],

  onCellClick: (pos) => {
    const state = get();
    if (state.status === 'redWin' || state.status === 'blackWin') return;
    if (state.aiThinking) return;
    if (state.mode === 'pve' && state.turn !== state.playerColor) return;
    if (state.mode === 'aiva') return; // 观战模式不允许点击

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
    if (state.mode === 'aiva') return;
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
    const { mode, playerColor } = get();
    const flipped = mode === 'pve' && playerColor === 'black';
    set({
      board: createInitialBoard(),
      turn: 'red',
      history: [],
      selected: null,
      legalMoves: [],
      status: 'playing',
      lastMove: null,
      aiThinking: false,
      flipped,
    });
  },

  flipBoard: () => {
    set((state) => ({ flipped: !state.flipped }));
  },

  setMode: (mode) => {
    const { playerColor } = get();
    const flipped = mode === 'pve' && playerColor === 'black';
    // 进入或离开 aiva 模式时同步学习权重
    if (mode === 'aiva') {
      applyLearnedWeights(get().learning);
    } else {
      setPieceWeights(get().learning.weights);
    }
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
      flipped,
    });
  },

  setPlayerColor: (playerColor) => {
    const { mode } = get();
    const flipped = mode === 'pve' && playerColor === 'black';
    set({
      playerColor,
      board: createInitialBoard(),
      turn: 'red',
      history: [],
      selected: null,
      legalMoves: [],
      status: 'playing',
      lastMove: null,
      aiThinking: false,
      flipped,
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
    if (state.mode !== 'pve' && state.mode !== 'aiva') return;
    if (state.status === 'redWin' || state.status === 'blackWin') return;
    if (state.aiThinking) return;

    // pve 模式：只有 AI 颜色走；aiva 模式：双方都由 AI 走
    let aiColor: Color;
    if (state.mode === 'pve') {
      aiColor = state.playerColor === 'red' ? 'black' : 'red';
      if (state.turn !== aiColor) return;
    } else {
      aiColor = state.turn;
    }

    set({ aiThinking: true, selected: null, legalMoves: [] });

    setTimeout(() => {
      const current = get();
      if (current.status === 'redWin' || current.status === 'blackWin') {
        set({ aiThinking: false });
        return;
      }
      if (current.mode === 'pve' && current.turn !== aiColor) {
        set({ aiThinking: false });
        return;
      }
      if (current.mode === 'aiva' && current.turn !== aiColor) {
        set({ aiThinking: false });
        return;
      }

      // aiva 模式：优先查开局库
      let best: { from: Position; to: Position } | null = null;
      if (current.mode === 'aiva' && current.history.length < 12) {
        const provider = createOpeningBookProvider(current.learning);
        best = provider(current.board, current.turn, current.history.length);
      }
      if (!best) {
        // 构建将军历史，防止 AI 连续将军超 3 次
        const checkHistory = buildCheckHistory(current.history);
        best = findBestMove(current.board, aiColor, current.difficulty, checkHistory);
      }

      if (!best) {
        const aiLost = aiColor === 'red' ? 'blackWin' : 'redWin';
        // aiva 模式下对局结束，进行学习
        if (current.mode === 'aiva') {
          const result = buildBattleResultFromHistory(current.history, aiLost);
          const newLearning = learnFromGame(current.learning, result);
          set({ aiThinking: false, status: aiLost, selected: null, legalMoves: [], learning: newLearning });
        } else {
          const humanWon = aiLost === 'redWin' ? current.playerColor === 'red' : current.playerColor === 'black';
          playSound(humanWon ? 'win' : 'lose');
          set({ aiThinking: false, status: aiLost, selected: null, legalMoves: [] });
        }
        return;
      }
      const result = applyMoveInternal(current, best.from, best.to);
      if (result) {
        // aiva 模式下若对局结束，进行学习
        if (
          current.mode === 'aiva' &&
          (result.status === 'redWin' || result.status === 'blackWin')
        ) {
          const newHistory = [...current.history];
          // applyMoveInternal 已把 move 加入 history，但 result.history 是新数组
          const battleResult = buildBattleResultFromHistory(
            result.history ?? newHistory,
            result.status ?? 'playing',
          );
          const newLearning = learnFromGame(current.learning, battleResult);
          set({ ...result, aiThinking: false, learning: newLearning });
        } else {
          set({ ...result, aiThinking: false });
        }
      } else {
        set({ aiThinking: false });
      }
    }, 280);
  },

  runSelfPlayBatch: (count, difficulty) => {
    const state = get();
    if (state.batchRunning) return;
    const diff = difficulty ?? state.difficulty;
    const learning = state.learning;
    applyLearnedWeights(learning);

    set({ batchRunning: true, batchTotal: count, batchDone: 0, batchLog: [] });

    let done = 0;
    let currentLearning = learning;

    const runOne = () => {
      const provider = createOpeningBookProvider(currentLearning);
      const result = aiSelfPlay(diff, 200, undefined, provider);
      currentLearning = learnFromGame(currentLearning, result);
      done++;

      const entry: BattleLogEntry = {
        index: done,
        winner: result.winner,
        moves: result.moves.length,
        reason: result.reason,
      };

      set({
        learning: { ...currentLearning },
        batchDone: done,
        batchLog: [...get().batchLog, entry].slice(-50),
      });

      if (done >= count) {
        set({ batchRunning: false });
        return;
      }
      // 让出主线程，避免阻塞 UI
      setTimeout(runOne, 0);
    };
    setTimeout(runOne, 0);
  },

  stopBatch: () => {
    set({ batchRunning: false });
  },

  resetLearning: () => {
    const fresh = resetLearningState();
    set({ learning: fresh, batchLog: [], batchDone: 0, batchTotal: 0 });
  },
}));

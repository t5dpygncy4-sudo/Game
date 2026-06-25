import type { Board, Color, PieceType, Position } from './types';
import { COLS, ROWS, createInitialBoard, cloneBoard } from './constants';
import {
  DEFAULT_PIECE_VALUE,
  type PieceWeights,
  type AIBattleResult,
  type Difficulty,
  setPieceWeights,
  resetPieceWeights,
} from './ai';

// ============ 持久化存储 ============

const STORAGE_KEY = 'xiangqi_learning_v1';
const OPENING_PHASE_MOVES = 12; // 前 12 步视为开局阶段
const GAMES_PER_GENERATION = 10; // 每 10 局晋升一个世代

export interface OpeningEntry {
  fromCol: number;
  fromRow: number;
  toCol: number;
  toRow: number;
  wins: number; // 该走法最终红方获胜次数（红方视角统计）
  losses: number; // 该走法最终红方失败次数
  total: number;
}

export interface LearningState {
  generation: number;
  totalGames: number;
  redWins: number;
  blackWins: number;
  draws: number;
  // 开局库：key = 局面哈希, value = 该局面下的走法统计列表
  openingBook: Record<string, OpeningEntry[]>;
  // 学习到的棋子权重
  weights: PieceWeights;
  learningRate: number;
  lastUpdated: number;
}

// ============ 局面哈希（轻量级字符串，用于开局库索引） ============

function boardHash(board: Board, turn: Color): string {
  let s = turn === 'red' ? 'R|' : 'B|';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (!p) {
        s += '.';
      } else {
        const t = p.type[0];
        s += p.color === 'red' ? t.toUpperCase() : t;
      }
    }
  }
  return s;
}

// ============ 加载 / 保存 ============

export function createEmptyLearningState(): LearningState {
  return {
    generation: 0,
    totalGames: 0,
    redWins: 0,
    blackWins: 0,
    draws: 0,
    openingBook: {},
    weights: { ...DEFAULT_PIECE_VALUE },
    learningRate: 0.05,
    lastUpdated: 0,
  };
}

export function loadLearningState(): LearningState {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        generation: parsed.generation ?? 0,
        totalGames: parsed.totalGames ?? 0,
        redWins: parsed.redWins ?? 0,
        blackWins: parsed.blackWins ?? 0,
        draws: parsed.draws ?? 0,
        openingBook: parsed.openingBook ?? {},
        weights: { ...DEFAULT_PIECE_VALUE, ...parsed.weights },
        learningRate: parsed.learningRate ?? 0.05,
        lastUpdated: parsed.lastUpdated ?? 0,
      };
    }
  } catch {
    // ignore
  }
  return createEmptyLearningState();
}

export function saveLearningState(state: LearningState): void {
  try {
    state.lastUpdated = Date.now();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // ignore
  }
}

export function resetLearningState(): LearningState {
  const state = createEmptyLearningState();
  saveLearningState(state);
  resetPieceWeights();
  return state;
}

// ============ 开局库查询与选择 ============

export function queryOpeningBook(
  state: LearningState,
  board: Board,
  turn: Color,
): OpeningEntry[] | null {
  const key = boardHash(board, turn);
  const entries = state.openingBook[key];
  if (!entries || entries.length === 0) return null;
  return entries;
}

/**
 * 基于胜率 + 探索（UCB 思想）从开局库挑选一步。
 * 返回 null 表示库中无合适走法。
 */
export function pickOpeningMove(
  state: LearningState,
  board: Board,
  turn: Color,
): { from: Position; to: Position } | null {
  const entries = queryOpeningBook(state, board, turn);
  if (!entries) return null;

  const logTotal = Math.log(state.totalGames + 1) + 1;
  let best: { entry: OpeningEntry; score: number } | null = null;

  for (const e of entries) {
    if (e.total === 0) continue;
    const redWinRate = e.wins / e.total;
    // 当前轮到 turn 走：红方希望红胜率高，黑方希望红胜率低
    const exploit = turn === 'red' ? redWinRate : 1 - redWinRate;
    // 探索项：尝试次数越少，探索分越高
    const explore = Math.sqrt((2 * logTotal) / (e.total + 1));
    const score = exploit + 0.15 * explore;
    if (!best || score > best.score) best = { entry: e, score };
  }

  if (!best) return null;
  return {
    from: { col: best.entry.fromCol, row: best.entry.fromRow },
    to: { col: best.entry.toCol, row: best.entry.toRow },
  };
}

/**
 * 构造一个用于 aiSelfPlay 的 moveProvider：前 N 步查开局库，之后返回 null。
 */
export function createOpeningBookProvider(
  state: LearningState,
  openingMoves = OPENING_PHASE_MOVES,
): (board: Board, turn: Color, moveCount: number) => { from: Position; to: Position } | null {
  return (board, turn, moveCount) => {
    if (moveCount >= openingMoves) return null;
    return pickOpeningMove(state, board, turn);
  };
}

// ============ 学习：从一局对局中更新 ============

/**
 * 从一局 AI 自我对战结果中学习：
 * 1. 更新开局库（前 N 步的走法统计）
 * 2. 微调棋子权重（基于胜负与吃子情况）
 * 3. 更新世代与统计
 * 返回新的 LearningState（已持久化）。
 */
export function learnFromGame(state: LearningState, result: AIBattleResult): LearningState {
  const newState: LearningState = {
    ...state,
    openingBook: { ...state.openingBook },
    weights: { ...state.weights },
  };

  // 重放走法，重建每步走子前的局面，用于开局库更新
  let board: Board = createInitialBoard();
  let turn: Color = 'red';
  const openingMoves = Math.min(OPENING_PHASE_MOVES, result.moves.length);

  for (let i = 0; i < result.moves.length; i++) {
    const move = result.moves[i];

    if (i < openingMoves) {
      updateOpeningBook(newState, board, turn, move, result.winner);
    }

    // 推进局面
    const next = cloneBoard(board);
    next[move.to.row][move.to.col] = next[move.from.row][move.from.col];
    next[move.from.row][move.from.col] = null;
    board = next;
    turn = turn === 'red' ? 'black' : 'red';
  }

  // 统计
  newState.totalGames++;
  if (result.winner === 'red') newState.redWins++;
  else if (result.winner === 'black') newState.blackWins++;
  else newState.draws++;

  // 权重微调
  if (result.winner !== 'draw') {
    tuneWeights(newState, result);
  }

  // 世代晋升 + 学习率退火
  if (newState.totalGames % GAMES_PER_GENERATION === 0) {
    newState.generation++;
    newState.learningRate = Math.max(0.01, 0.05 * Math.pow(0.95, newState.generation));
  }

  saveLearningState(newState);
  return newState;
}

function updateOpeningBook(
  state: LearningState,
  board: Board,
  turn: Color,
  move: { from: Position; to: Position },
  winner: Color | 'draw',
): void {
  const key = boardHash(board, turn);
  if (!state.openingBook[key]) {
    state.openingBook[key] = [];
  }
  const entries = state.openingBook[key];
  let entry = entries.find(
    (e) =>
      e.fromCol === move.from.col &&
      e.fromRow === move.from.row &&
      e.toCol === move.to.col &&
      e.toRow === move.to.row,
  );
  if (!entry) {
    entry = {
      fromCol: move.from.col,
      fromRow: move.from.row,
      toCol: move.to.col,
      toRow: move.to.row,
      wins: 0,
      losses: 0,
      total: 0,
    };
    entries.push(entry);
  }
  entry.total++;
  if (winner === 'red') entry.wins++;
  else if (winner === 'black') entry.losses++;
}

/**
 * 权重微调策略：
 * - 获胜方吃掉的关键棋子 → 那些棋子权重略升（它们是关键威胁/资源）
 * - 失败方损失的棋子类型也反映其价值
 * - 学习率随世代衰减
 */
function tuneWeights(state: LearningState, result: AIBattleResult): void {
  const winner: Color = result.winner as Color;
  const capturedByWinner: Partial<Record<PieceType, number>> = {};
  const lostByWinner: Partial<Record<PieceType, number>> = {};

  for (const move of result.moves) {
    if (!move.captured) continue;
    if (move.piece.color === winner) {
      capturedByWinner[move.captured.type] = (capturedByWinner[move.captured.type] ?? 0) + 1;
    } else {
      lostByWinner[move.captured.type] = (lostByWinner[move.captured.type] ?? 0) + 1;
    }
  }

  const lr = state.learningRate;
  (Object.keys(capturedByWinner) as PieceType[]).forEach((type) => {
    if (type === 'king') return;
    const count = capturedByWinner[type]!;
    const delta = lr * count * 5;
    state.weights[type] = clampWeight(type, state.weights[type] + delta);
  });
  // 获胜方损失的重要棋子 → 该棋子权重略降（说明它易被针对），但幅度小
  (Object.keys(lostByWinner) as PieceType[]).forEach((type) => {
    if (type === 'king') return;
    const count = lostByWinner[type]!;
    const delta = -lr * count * 2;
    state.weights[type] = clampWeight(type, state.weights[type] + delta);
  });
}

function clampWeight(type: PieceType, value: number): number {
  const base = DEFAULT_PIECE_VALUE[type];
  return Math.max(base * 0.7, Math.min(base * 1.3, value));
}

// ============ 应用学习权重到 AI ============

export function applyLearnedWeights(state: LearningState): void {
  setPieceWeights(state.weights);
}

export function clearLearnedWeights(): void {
  resetPieceWeights();
}

// ============ 统计辅助 ============

export function getLearningSummary(state: LearningState): {
  generation: number;
  totalGames: number;
  redWinRate: number;
  blackWinRate: number;
  drawRate: number;
  openingBookSize: number;
} {
  const total = state.totalGames || 1;
  return {
    generation: state.generation,
    totalGames: state.totalGames,
    redWinRate: state.redWins / total,
    blackWinRate: state.blackWins / total,
    drawRate: state.draws / total,
    openingBookSize: Object.keys(state.openingBook).length,
  };
}

export type { Difficulty };

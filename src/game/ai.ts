import type { Board, Color, PieceType, Position } from './types';
import { COLS, ROWS, crossedRiver, createInitialBoard, cloneBoard } from './constants';
import { getPseudoMoves } from './moves';
import { isInCheck } from './judge';
import { getGameStatus, getLegalMoves } from './validate';
import { getNotation } from './notation';

export type Difficulty = 'beginner' | 'advanced' | 'master';

export interface AIConfig {
  depth: number;
  randomness: number;
  timeLimit: number; // ms
}

export const DIFFICULTY_CONFIG: Record<Difficulty, AIConfig> = {
  beginner: { depth: 4, randomness: 60, timeLimit: 400 },
  advanced: { depth: 6, randomness: 20, timeLimit: 1200 },
  master: { depth: 8, randomness: 0, timeLimit: 3000 },
};

// ============ 可调权重（学习系统可修改） ============

export interface PieceWeights {
  king: number;
  chariot: number;
  horse: number;
  cannon: number;
  advisor: number;
  elephant: number;
  soldier: number;
}

export const DEFAULT_PIECE_VALUE: PieceWeights = {
  king: 20000,
  chariot: 900,
  horse: 400,
  cannon: 450,
  advisor: 200,
  elephant: 200,
  soldier: 100,
};

// PST 偏移量（学习系统在此基础上微调）
export const DEFAULT_PST_BONUS = 1.0;

// ============ AI 性格（多样化思路） ============

export type Personality = 'balanced' | 'aggressive' | 'defensive' | 'positional';

export interface PersonalityProfile {
  name: string;
  // 评估函数各项权重
  mobilityWeight: number;   // 机动性权重
  kingSafetyWeight: number; // 王安全权重
  captureBonus: number;    // 吃子额外奖励（激进派更高）
  pstMultiplier: number;   // PST 权重倍数（位置派更高）
  // 选择 top-N 走法时的 N（开局多样化）
  openingVariety: number;
  // 中局选择容差：分数差 < tolerance 的走法视为等价
  midgameTolerance: number;
}

export const PERSONALITIES: Record<Personality, PersonalityProfile> = {
  // 均衡型：标准权重
  balanced: {
    name: '均衡',
    mobilityWeight: 2,
    kingSafetyWeight: 1,
    captureBonus: 0,
    pstMultiplier: 1.0,
    openingVariety: 3,
    midgameTolerance: 15,
  },
  // 激进型：重视机动性与吃子，王安全次之
  aggressive: {
    name: '激进',
    mobilityWeight: 4,
    kingSafetyWeight: 0.6,
    captureBonus: 30,
    pstMultiplier: 0.9,
    openingVariety: 4,
    midgameTolerance: 25,
  },
  // 稳健型：重视王安全，少吃子冒险
  defensive: {
    name: '稳健',
    mobilityWeight: 1,
    kingSafetyWeight: 2.0,
    captureBonus: -10,
    pstMultiplier: 1.1,
    openingVariety: 3,
    midgameTolerance: 10,
  },
  // 位置型：重视棋子位置（PST），机动性中等
  positional: {
    name: '诡异',
    mobilityWeight: 1.5,
    kingSafetyWeight: 1.2,
    captureBonus: 5,
    pstMultiplier: 1.6,
    openingVariety: 5,
    midgameTolerance: 30,
  },
};

const PERSONALITY_LIST: Personality[] = ['balanced', 'aggressive', 'defensive', 'positional'];

// 当前生效的性格
let currentPersonality: Personality = 'balanced';

export function setPersonality(p: Personality): void {
  currentPersonality = p;
}

export function getPersonality(): Personality {
  return currentPersonality;
}

export function getCurrentPersonalityProfile(): PersonalityProfile {
  return PERSONALITIES[currentPersonality];
}

export function randomPersonality(): Personality {
  return PERSONALITY_LIST[Math.floor(Math.random() * PERSONALITY_LIST.length)];
}

const PIECE_VALUE: Record<PieceType, number> = { ...DEFAULT_PIECE_VALUE };

// 学习系统可注入权重
let currentPieceValue: Record<PieceType, number> = PIECE_VALUE;

export function setPieceWeights(weights: PieceWeights): void {
  currentPieceValue = { ...weights };
}

export function resetPieceWeights(): void {
  currentPieceValue = { ...DEFAULT_PIECE_VALUE };
}

export function getPieceValue(type: PieceType): number {
  return currentPieceValue[type];
}

const MATE_SCORE = 100000;

// ============ PST 表 ============

const SOLDIER_PST_RED = [
  [9, 9, 9, 11, 13, 11, 9, 9, 9],
  [19, 24, 34, 42, 44, 42, 34, 24, 19],
  [19, 24, 32, 37, 37, 37, 32, 24, 19],
  [19, 23, 27, 29, 30, 29, 27, 23, 19],
  [14, 18, 20, 27, 29, 27, 20, 18, 14],
  [7, 0, 13, 0, 16, 0, 13, 0, 7],
  [7, 0, 7, 0, 15, 0, 7, 0, 7],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
];

const HORSE_PST_RED = [
  [4, 8, 16, 12, 4, 12, 16, 8, 4],
  [4, 10, 28, 16, 8, 16, 28, 10, 4],
  [12, 14, 16, 20, 18, 20, 16, 14, 12],
  [8, 24, 18, 24, 20, 24, 18, 24, 8],
  [6, 16, 14, 18, 16, 18, 14, 16, 6],
  [4, 12, 16, 14, 12, 14, 16, 12, 4],
  [2, 6, 8, 6, 10, 6, 8, 6, 2],
  [4, 2, 8, 8, 4, 8, 8, 2, 4],
  [0, 2, 4, 4, -2, 4, 4, 2, 0],
  [0, -4, 0, 0, 0, 0, 0, -4, 0],
];

const CHARIOT_PST_RED = [
  [14, 14, 12, 18, 16, 18, 12, 14, 14],
  [16, 20, 18, 24, 26, 24, 18, 20, 16],
  [12, 12, 12, 18, 18, 18, 12, 12, 12],
  [12, 18, 16, 22, 22, 22, 16, 18, 12],
  [12, 14, 12, 18, 18, 18, 12, 14, 12],
  [12, 16, 14, 20, 20, 20, 14, 16, 12],
  [6, 10, 8, 14, 14, 14, 8, 10, 6],
  [4, 8, 6, 14, 12, 14, 6, 8, 4],
  [8, 4, 8, 16, 8, 16, 8, 4, 8],
  [-2, 10, 6, 14, 12, 14, 6, 10, -2],
];

const CANNON_PST_RED = [
  [6, 4, 0, -10, -12, -10, 0, 4, 6],
  [2, 2, 0, -4, -14, -4, 0, 2, 2],
  [2, 2, 0, -10, -8, -10, 0, 2, 2],
  [0, 0, -2, 4, 10, 4, -2, 0, 0],
  [0, 0, 0, 2, 8, 2, 0, 0, 0],
  [-2, 0, 4, 2, 6, 2, 4, 0, -2],
  [0, 0, 0, 2, 4, 2, 0, 0, 0],
  [4, 0, 8, 6, 10, 6, 8, 0, 4],
  [0, 2, 4, 6, 6, 6, 4, 2, 0],
  [0, 0, 2, 6, 6, 6, 2, 0, 0],
];

const KING_PST_RED = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 1, 3, 1, 0, 0, 0],
  [0, 0, 0, 2, 6, 2, 0, 0, 0],
];

const ADVISOR_PST_RED = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 3, 0, 0, 0, 0],
  [0, 0, 0, 3, 0, 3, 0, 0, 0],
];

const ELEPHANT_PST_RED = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 2, 0, 0, 0, 2, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [2, 0, 0, 0, 3, 0, 0, 0, 2],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
];

const PST_RED: Record<PieceType, number[][]> = {
  king: KING_PST_RED,
  advisor: ADVISOR_PST_RED,
  elephant: ELEPHANT_PST_RED,
  horse: HORSE_PST_RED,
  chariot: CHARIOT_PST_RED,
  cannon: CANNON_PST_RED,
  soldier: SOLDIER_PST_RED,
};

function pstValue(type: PieceType, col: number, row: number, color: Color): number {
  const table = PST_RED[type];
  if (color === 'red') {
    return table[row][col];
  }
  return table[ROWS - 1 - row][COLS - 1 - col];
}

// ============ Zobrist 哈希 ============

let zobristTable: { red: bigint[]; black: bigint[] }[] | null = null;
let zobristSide: bigint;

function initZobrist() {
  if (zobristTable) return;
  zobristTable = [];
  // 用确定性伪随机生成器保证可复现
  let seed = 12345n;
  const rand = () => {
    seed = (seed * 1103515245n + 12345n) & 0x7fffffffffffffffn;
    return seed;
  };
  for (let i = 0; i < ROWS * COLS; i++) {
    zobristTable.push({
      red: [rand(), rand(), rand(), rand(), rand(), rand(), rand()],
      black: [rand(), rand(), rand(), rand(), rand(), rand(), rand()],
    });
  }
  zobristSide = rand();
}

const PIECE_TYPE_INDEX: Record<PieceType, number> = {
  king: 0,
  advisor: 1,
  elephant: 2,
  horse: 3,
  chariot: 4,
  cannon: 5,
  soldier: 6,
};

function computeZobrist(board: Board, side: Color): bigint {
  initZobrist();
  let hash = 0n;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const piece = board[row][col];
      if (!piece) continue;
      const idx = row * COLS + col;
      const typeIdx = PIECE_TYPE_INDEX[piece.type];
      hash ^= piece.color === 'red'
        ? zobristTable![idx].red[typeIdx]
        : zobristTable![idx].black[typeIdx];
    }
  }
  if (side === 'black') hash ^= zobristSide;
  return hash;
}

// ============ 置换表 ============

const TT_EXACT = 0;
const TT_LOWER = 1;
const TT_UPPER = 2;

interface TTEntry {
  key: bigint;
  depth: number;
  flag: number;
  value: number;
  bestFrom: Position | null;
  bestTo: Position | null;
}

const transpositionTable = new Map<bigint, TTEntry>();
const TT_MAX_SIZE = 50000;

function storeTT(key: bigint, depth: number, flag: number, value: number, bestFrom: Position | null, bestTo: Position | null) {
  if (transpositionTable.size >= TT_MAX_SIZE) {
    // 简单清理：清空一半
    const keys = transpositionTable.keys();
    let count = 0;
    for (const k of keys) {
      transpositionTable.delete(k);
      count++;
      if (count >= TT_MAX_SIZE / 2) break;
    }
  }
  transpositionTable.set(key, { key, depth, flag, value, bestFrom, bestTo });
}

function probeTT(key: bigint): TTEntry | undefined {
  return transpositionTable.get(key);
}

// ============ 评估函数（增强版） ============

export function evaluate(board: Board): number {
  const profile = getCurrentPersonalityProfile();
  let score = 0;
  let redKing = false;
  let blackKing = false;
  let redKingPos: Position | null = null;
  let blackKingPos: Position | null = null;

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const piece = board[row][col];
      if (!piece) continue;
      let val = currentPieceValue[piece.type];
      if (piece.type === 'soldier' && crossedRiver(row, piece.color)) {
        val += 50;
      }
      // PST 值按性格倍数缩放
      val += pstValue(piece.type, col, row, piece.color) * profile.pstMultiplier;
      if (piece.color === 'red') {
        score += val;
        if (piece.type === 'king') {
          redKing = true;
          redKingPos = { col, row };
        }
      } else {
        score -= val;
        if (piece.type === 'king') {
          blackKing = true;
          blackKingPos = { col, row };
        }
      }
    }
  }

  if (!redKing) return -MATE_SCORE;
  if (!blackKing) return MATE_SCORE;

  // 王安全评估（按性格权重）
  if (redKingPos) score += kingSafety(board, redKingPos, 'red') * profile.kingSafetyWeight;
  if (blackKingPos) score -= kingSafety(board, blackKingPos, 'black') * profile.kingSafetyWeight;

  // 机动性评估（只在中浅层计算，避免过慢）
  if (mobilityEnabled) {
    const redMobility = countMobility(board, 'red');
    const blackMobility = countMobility(board, 'black');
    score += (redMobility - blackMobility) * profile.mobilityWeight;
  }

  return score;
}

// 王安全：王周围 8 格己方棋子数量 × 系数
function kingSafety(board: Board, kingPos: Position, color: Color): number {
  let safety = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = kingPos.row + dr;
      const c = kingPos.col + dc;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
      const p = board[r][c];
      if (p && p.color === color) {
        // 士相守王最有价值，其他棋子次之
        if (p.type === 'advisor' || p.type === 'elephant') safety += 8;
        else if (p.type === 'chariot' || p.type === 'cannon') safety += 3;
        else safety += 1;
      }
    }
  }
  return safety;
}

let mobilityEnabled = true;

function countMobility(board: Board, color: Color): number {
  let count = 0;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const piece = board[row][col];
      if (!piece || piece.color !== color) continue;
      count += getPseudoMoves(board, { col, row }).length;
    }
  }
  return count;
}

// ============ 走法生成与执行 ============

interface SearchMove {
  from: Position;
  to: Position;
  captured: { type: PieceType; color: Color } | null;
  score: number; // 走法排序分
}

function generateMoves(board: Board, color: Color): SearchMove[] {
  const moves: SearchMove[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const piece = board[row][col];
      if (!piece || piece.color !== color) continue;
      const from = { col, row };
      const targets = getPseudoMoves(board, from);
      for (const to of targets) {
        const target = board[to.row][to.col];
        moves.push({
          from,
          to,
          captured: target ? { type: target.type, color: target.color } : null,
          score: 0,
        });
      }
    }
  }
  return moves;
}

function generateLegalMoves(board: Board, color: Color): SearchMove[] {
  const moves: SearchMove[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const piece = board[row][col];
      if (!piece || piece.color !== color) continue;
      const from = { col, row };
      const targets = getPseudoMoves(board, from);
      for (const to of targets) {
        const target = board[to.row][to.col];
        const move: SearchMove = {
          from,
          to,
          captured: target ? { type: target.type, color: target.color } : null,
          score: 0,
        };
        makeMove(board, move);
        const stillSafe = !isInCheck(board, color);
        unmakeMove(board, move);
        if (stillSafe) moves.push(move);
      }
    }
  }
  return moves;
}

// MVV-LVA 走法排序 + 杀手走法 + 历史启发（内联版，board 直接传入）

function sameMove(a: SearchMove, b: SearchMove): boolean {
  return a.from.col === b.from.col && a.from.row === b.from.row && a.to.col === b.to.col && a.to.row === b.to.row;
}

function makeMove(board: Board, move: SearchMove): void {
  board[move.to.row][move.to.col] = board[move.from.row][move.from.col];
  board[move.from.row][move.from.col] = null;
}

function unmakeMove(board: Board, move: SearchMove): void {
  board[move.from.row][move.from.col] = board[move.to.row][move.to.col];
  board[move.to.row][move.to.col] = move.captured ? { ...move.captured } : null;
}

// ============ 搜索引擎（增强版） ============

let searchStartTime = 0;
let searchTimeLimit = 2000;
let searchCancelled = false;

function timeUp(): boolean {
  if (searchCancelled) return true;
  return Date.now() - searchStartTime > searchTimeLimit;
}

// 杀手走法表：[ply][0/1]
const killerMoves: (SearchMove | null)[][] = [];

function initKillers(maxPly: number) {
  killerMoves.length = 0;
  for (let i = 0; i < maxPly; i++) {
    killerMoves.push([null, null]);
  }
}

function storeKiller(ply: number, move: SearchMove) {
  if (move.captured) return; // 只存非吃子走法
  const k = killerMoves[ply];
  if (!k) return;
  if (k[0] && sameMove(k[0], move)) return;
  k[1] = k[0];
  k[0] = move;
}

// 历史启发表
const historyTable = new Map<string, number>();

function storeHistory(move: SearchMove, depth: number) {
  const hkey = `${move.from.col},${move.from.row},${move.to.col},${move.to.row}`;
  historyTable.set(hkey, (historyTable.get(hkey) ?? 0) + depth * depth);
}

function resetHistory() {
  historyTable.clear();
}

// 增强版走法排序（内联版，避免 board_pieceTypeAt 的问题）
function scoreMovesInternal(
  board: Board,
  moves: SearchMove[],
  ttBestFrom: Position | null,
  ttBestTo: Position | null,
  ply: number,
): void {
  const k1 = killerMoves[ply]?.[0] ?? null;
  const k2 = killerMoves[ply]?.[1] ?? null;
  for (const move of moves) {
    let s = 0;
    if (ttBestFrom && ttBestTo && move.from.col === ttBestFrom.col && move.from.row === ttBestFrom.row && move.to.col === ttBestTo.col && move.to.row === ttBestTo.row) {
      s += 100000;
    }
    if (move.captured) {
      const attacker = board[move.from.row][move.from.col];
      s += 10000 + currentPieceValue[move.captured.type] * 10 - currentPieceValue[attacker!.type];
    }
    if (k1 && sameMove(move, k1)) s += 9000;
    else if (k2 && sameMove(move, k2)) s += 8000;
    const hkey = `${move.from.col},${move.from.row},${move.to.col},${move.to.row}`;
    s += historyTable.get(hkey) ?? 0;
    move.score = s;
  }
  moves.sort((a, b) => b.score - a.score);
}

function negamax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  color: Color,
  ply: number,
  allowNull: boolean,
): number {
  // 时间检查
  if ((ply & 3) === 0 && timeUp()) {
    searchCancelled = true;
    return evaluate(board) * (color === 'red' ? 1 : -1);
  }

  const zobrist = computeZobrist(board, color);
  const alphaOrig = alpha;

  // 置换表查找
  const tt = probeTT(zobrist);
  if (tt && tt.depth >= depth) {
    if (tt.flag === TT_EXACT) return tt.value;
    if (tt.flag === TT_LOWER && tt.value >= beta) return tt.value;
    if (tt.flag === TT_UPPER && tt.value <= alpha) return tt.value;
  }

  // 终止条件
  const standPat = evaluate(board) * (color === 'red' ? 1 : -1);
  if (Math.abs(standPat) >= MATE_SCORE) return standPat;
  if (depth <= 0) {
    // 叶节点使用静止搜索，避免战术盲点（如被吃大子）
    return quiescence(board, alpha, beta, color, ply);
  }

  // 空步裁剪
  if (allowNull && depth >= 3 && !isInCheck(board, color) && Math.abs(standPat) < MATE_SCORE - 100) {
    // 跳过一步（换边走）
    const oppColor: Color = color === 'red' ? 'black' : 'red';
    const nullScore = -negamax(board, depth - 1 - 2, -beta, -beta + 1, oppColor, ply + 1, false);
    if (nullScore >= beta) {
      return beta;
    }
  }

  const moves = generateMoves(board, color);
  if (moves.length === 0) {
    // 无走法 = 被将死或困毙
    return -MATE_SCORE + ply;
  }

  scoreMovesInternal(board, moves, tt?.bestFrom ?? null, tt?.bestTo ?? null, ply);

  let bestScore = -Infinity;
  let bestMove: SearchMove | null = null;

  for (const move of moves) {
    makeMove(board, move);
    // 检查是否送将
    if (isInCheck(board, color)) {
      unmakeMove(board, move);
      continue; // 跳过非法走法
    }
    const oppColor: Color = color === 'red' ? 'black' : 'red';
    const score = -negamax(board, depth - 1, -beta, -alpha, oppColor, ply + 1, true);
    unmakeMove(board, move);

    if (searchCancelled) break;

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    if (score > alpha) alpha = score;
    if (alpha >= beta) {
      // 剪枝
      if (!move.captured) {
        storeKiller(ply, move);
        storeHistory(move, depth);
      }
      break;
    }
  }

  if (bestMove === null) {
    // 所有走法都非法 = 被将死/困毙
    return -MATE_SCORE + ply;
  }

  // 存置换表
  let flag = TT_EXACT;
  if (bestScore <= alphaOrig) flag = TT_UPPER;
  else if (bestScore >= beta) flag = TT_LOWER;
  storeTT(zobrist, depth, flag, bestScore, bestMove.from, bestMove.to);

  return bestScore;
}

// ============ 重复将军 / 局面重复检测 ============

/**
 * 历史走法记录（用于检测连续将军与局面重复）。
 * recentChecks: 最近若干步中，每步是否为将军、以及由哪个棋子（from 位置）发出。
 * boardHashAfter: 走完该步后局面的哈希（含轮走方），用于检测局面重复 / 避免循环棋。
 */
export interface MoveHistoryEntry {
  from: Position;
  to: Position;
  color: Color;
  isCheck: boolean; // 该步是否将军对方
  pieceType: PieceType;
  boardHashAfter: string;
}

const MAX_CHECK_REPETITION = 3; // 同一棋子连续将军最多 3 次

/**
 * 判断给定的「候选走法」是否构成违规连续将军。
 * 规则：同一棋子（同 from 位置、同类型）连续将军次数已达上限则禁止继续将军。
 */
function wouldViolateCheckRepetition(
  recentChecks: MoveHistoryEntry[],
  candidateFrom: Position,
  candidateIsCheck: boolean,
): boolean {
  if (!candidateIsCheck) return false;
  // 从末尾向前统计同一 from 位置的连续将军步数
  let count = 0;
  for (let i = recentChecks.length - 1; i >= 0; i--) {
    const e = recentChecks[i];
    if (!e.isCheck) break;
    if (e.from.col === candidateFrom.col && e.from.row === candidateFrom.row) {
      count++;
    } else {
      // 中间夹了其他棋子的将军也算连续将军序列的一部分（长将）
      // 但我们只限制同一棋子连续将军，所以遇到不同棋子的将军就停止
      break;
    }
  }
  return count >= MAX_CHECK_REPETITION;
}

/**
 * 检测局面重复：返回该局面在历史中出现的次数。
 * 用于判断和棋（三次重复）。
 * 使用 MoveHistoryEntry.boardHashAfter 直接比对，无需重新模拟棋盘。
 */
export function countRepetition(history: MoveHistoryEntry[], board: Board, turn: Color): number {
  const currentHash = boardHashWithTurn(board, turn);
  let count = 0;
  // 初始局面（红方轮走）也算一次出现
  const initialHash = boardHashWithTurn(createInitialBoard(), 'red');
  if (initialHash === currentHash) count++;
  for (const e of history) {
    if (e.boardHashAfter === currentHash) count++;
  }
  return count;
}

/**
 * 快速检测：当前局面是否已达到 N 次重复（用于和棋判定）。
 * 用 Map 索引避免重复遍历。
 */
export function isRepetitionDraw(history: MoveHistoryEntry[], board: Board, turn: Color, threshold = 3): boolean {
  const currentHash = boardHashWithTurn(board, turn);
  let count = 0;
  const initialHash = boardHashWithTurn(createInitialBoard(), 'red');
  if (initialHash === currentHash) count++;
  for (const e of history) {
    if (e.boardHashAfter === currentHash) {
      count++;
      if (count >= threshold) return true;
    }
  }
  return count >= threshold;
}

function boardHashSimple(board: Board): string {
  let s = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (!p) s += '.';
      else s += p.color === 'red' ? p.type[0].toUpperCase() : p.type[0];
    }
  }
  return s;
}

/** 含轮走方的局面哈希：相同棋盘不同方走视为不同局面 */
export function boardHashWithTurn(board: Board, turn: Color): string {
  return boardHashSimple(board) + (turn === 'red' ? '|R' : '|B');
}

// ============ 静止搜索（Quiescence） ============

function quiescence(board: Board, alpha: number, beta: number, color: Color, ply: number): number {
  if ((ply & 7) === 0 && timeUp()) {
    searchCancelled = true;
    return evaluate(board) * (color === 'red' ? 1 : -1);
  }
  const standPat = evaluate(board) * (color === 'red' ? 1 : -1);
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;
  if (Math.abs(standPat) >= MATE_SCORE) return standPat;

  // 只生成吃子走法
  const moves = generateMoves(board, color);
  const captureMoves = moves.filter((m) => m.captured !== null);
  // MVV-LVA 排序
  for (const m of captureMoves) {
    const attacker = board[m.from.row][m.from.col];
    m.score = 10000 + currentPieceValue[m.captured!.type] * 10 - currentPieceValue[attacker!.type];
  }
  captureMoves.sort((a, b) => b.score - a.score);

  for (const move of captureMoves) {
    makeMove(board, move);
    if (isInCheck(board, color)) {
      unmakeMove(board, move);
      continue;
    }
    const oppColor: Color = color === 'red' ? 'black' : 'red';
    const score = -quiescence(board, -beta, -alpha, oppColor, ply + 1);
    unmakeMove(board, move);
    if (searchCancelled) return alpha;
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

// ============ 迭代深化搜索 ============

export function findBestMove(
  board: Board,
  color: Color,
  difficulty: Difficulty,
  recentChecks: MoveHistoryEntry[] = [],
): { from: Position; to: Position } | null {
  const config = DIFFICULTY_CONFIG[difficulty];

  const moves = generateLegalMoves(board, color);
  if (moves.length === 0) return null;

  // 预先过滤违规连续将军走法
  const oppColor: Color = color === 'red' ? 'black' : 'red';
  const filteredMoves = moves.filter((m) => {
    makeMove(board, m);
    const isCheck = isInCheck(board, oppColor);
    unmakeMove(board, m);
    return !wouldViolateCheckRepetition(recentChecks, m.from, isCheck);
  });
  // 若过滤后无走法（罕见，说明所有走法都是违规长将），则退回原走法
  const movesToSearch = filteredMoves.length > 0 ? filteredMoves : moves;

  const workBoard = board.map((r) => r.map((c) => (c ? { ...c } : null)));

  // 预计算每个走法走完后形成的局面哈希及其在历史中的重复次数
  // 用于在选走法时避开循环棋（双方反复走同样局面）
  const REPETITION_PENALTY = 2000; // 远大于 tolerance，确保重复走法跌出 top-N
  const initialHash = boardHashWithTurn(createInitialBoard(), 'red');
  // 用 Map 索引历史中每个局面哈希的出现次数，避免 O(moves × history) 双重遍历
  const historyHashCount = new Map<string, number>();
  for (const e of recentChecks) {
    historyHashCount.set(e.boardHashAfter, (historyHashCount.get(e.boardHashAfter) ?? 0) + 1);
  }
  const moveRepCount = new Map<SearchMove, number>();
  for (const move of movesToSearch) {
    makeMove(workBoard, move);
    const hashAfter = boardHashWithTurn(workBoard, oppColor);
    unmakeMove(workBoard, move);
    let repCount = historyHashCount.get(hashAfter) ?? 0;
    if (hashAfter === initialHash) repCount++; // 回到初始局面
    moveRepCount.set(move, repCount);
  }

  // 初始化搜索状态
  searchStartTime = Date.now();
  searchTimeLimit = config.timeLimit;
  searchCancelled = false;
  transpositionTable.clear();
  resetHistory();
  initKillers(config.depth + 4);
  mobilityEnabled = difficulty !== 'beginner';

  let bestMove: SearchMove | null = null;
  let bestScore = -Infinity;

  // 迭代深化：从 1 层到 config.depth
  for (let depth = 1; depth <= config.depth; depth++) {
    if (searchCancelled) break;

    const scored: { move: SearchMove; score: number }[] = [];

    // 上一轮的最佳走法排在最前
    if (bestMove) {
      for (const m of movesToSearch) {
        if (sameMove(m, bestMove!)) {
          m.score = 1000000;
        } else {
          m.score = 0;
        }
      }
      movesToSearch.sort((a, b) => b.score - a.score);
    }

    for (const move of movesToSearch) {
      makeMove(workBoard, move);
      const score = -negamax(workBoard, depth - 1, -Infinity, Infinity, oppColor, 1, true);
      unmakeMove(workBoard, move);

      if (searchCancelled && depth > 1) break;

      // 应用重复局面惩罚：避免循环棋
      const rep = moveRepCount.get(move) ?? 0;
      scored.push({ move, score: score - rep * REPETITION_PENALTY });
    }

    if (!searchCancelled || depth === 1) {
      // negamax 返回的是当前走子方视角的分数（正=对当前方有利），
      // 无论红黑都应取最高分
      scored.sort((a, b) => b.score - a.score);
      if (scored.length > 0) {
        bestMove = scored[0].move;
        bestScore = scored[0].score;

        // 如果找到将死，提前退出
        if (Math.abs(bestScore) >= MATE_SCORE - 100) break;
      }
    }
  }

  // 随机性（低难度）
  if (config.randomness > 0 && bestMove) {
    const allScored: { move: SearchMove; score: number }[] = [];
    for (const move of movesToSearch) {
      makeMove(workBoard, move);
      const score = -negamax(workBoard, 1, -Infinity, Infinity, oppColor, 1, true);
      unmakeMove(workBoard, move);
      const rep = moveRepCount.get(move) ?? 0;
      allScored.push({ move, score: score - rep * REPETITION_PENALTY });
    }
    allScored.sort((a, b) => b.score - a.score);
    const bestScoreVal = allScored[0].score;
    const candidates = allScored.filter((s) => Math.abs(s.score - bestScoreVal) <= config.randomness);
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    return { from: pick.move.from, to: pick.move.to };
  }

  if (!bestMove) {
    // 兜底：返回第一个合法走法
    return { from: movesToSearch[0].from, to: movesToSearch[0].to };
  }

  // 多样化选择：在开局阶段或中局，若多个走法分数接近，随机选择
  // 开局阶段（前 12 步）：从 top-N 中随机选
  const profile = getCurrentPersonalityProfile();
  const isOpening = recentChecks.length < 12;
  const tolerance = isOpening ? 80 : profile.midgameTolerance;
  const varietyN = isOpening ? profile.openingVariety : Math.min(3, profile.openingVariety);

  // 重新评估 top 走法（最后一轮迭代的结果），并应用重复惩罚
  if (!searchCancelled) {
    const finalScored: { move: SearchMove; score: number }[] = [];
    for (const move of movesToSearch) {
      makeMove(workBoard, move);
      const score = -negamax(workBoard, Math.min(config.depth, 4), -Infinity, Infinity, oppColor, 1, true);
      unmakeMove(workBoard, move);
      const rep = moveRepCount.get(move) ?? 0;
      finalScored.push({ move, score: score - rep * REPETITION_PENALTY });
      if (searchCancelled) break;
    }

    if (finalScored.length > 0) {
      finalScored.sort((a, b) => b.score - a.score);
      const topScore = finalScored[0].score;
      // 若找到将死，直接返回（不容随机）
      if (Math.abs(topScore) >= MATE_SCORE - 100) {
        return { from: finalScored[0].move.from, to: finalScored[0].move.to };
      }
      // 取分数差 < tolerance 的候选（topScore - s.score >= 0）
      const candidates = finalScored.filter((s) => topScore - s.score <= tolerance);
      const n = Math.min(varietyN, candidates.length);
      const pick = candidates[Math.floor(Math.random() * n)];
      return { from: pick.move.from, to: pick.move.to };
    }
  }

  return { from: bestMove.from, to: bestMove.to };
}

// ============ AI 自我对战接口 ============

export interface AIBattleMove {
  from: Position;
  to: Position;
  piece: { type: PieceType; color: Color };
  captured?: { type: PieceType; color: Color };
  notation: string;
}

export interface AIBattleResult {
  winner: Color | 'draw';
  moves: AIBattleMove[];
  reason: string;
  finalBoard: Board;
}

/**
 * AI 自我对战一局
 * @param difficulty AI 难度
 * @param maxMoves 最大步数（防止无限对局）
 * @param onMove 每步回调（可用于 UI 更新）
 * @param moveProvider 可选的走法提供者（如开局库），返回 {from,to} 则直接采用，否则调用 findBestMove
 */
export function aiSelfPlay(
  difficulty: Difficulty,
  maxMoves = 200,
  onMove?: (board: Board, move: AIBattleMove, moveCount: number) => void,
  moveProvider?: (board: Board, turn: Color, moveCount: number) => { from: Position; to: Position } | null,
): AIBattleResult {
  let board: Board = createInitialBoard();
  let turn: Color = 'red';
  const moves: AIBattleMove[] = [];
  const checkHistory: MoveHistoryEntry[] = [];
  let moveCount = 0;

  while (moveCount < maxMoves) {
    const status = getGameStatus(board, turn);
    if (status === 'redWin') {
      return { winner: 'red', moves, reason: '黑方被将死', finalBoard: board };
    }
    if (status === 'blackWin') {
      return { winner: 'black', moves, reason: '红方被将死', finalBoard: board };
    }

    // 三次重复局面判和
    if (isRepetitionDraw(checkHistory, board, turn, 3)) {
      return { winner: 'draw', moves, reason: '三次重复局面', finalBoard: board };
    }

    // 优先使用外部走法提供者（开局库等），失败则回退到搜索
    let best: { from: Position; to: Position } | null = null;
    if (moveProvider) {
      const provided = moveProvider(board, turn, moveCount);
      if (provided) {
        // 校验合法性
        const piece = board[provided.from.row][provided.from.col];
        if (piece && piece.color === turn) {
          const legal = getLegalMoves(board, provided.from);
          if (legal.some((p) => p.col === provided.to.col && p.row === provided.to.row)) {
            best = provided;
          }
        }
      }
    }
    if (!best) {
      // 传入将军历史，防止连续将军超 3 次
      best = findBestMove(board, turn, difficulty, checkHistory);
    }
    if (!best) {
      const winner: Color = turn === 'red' ? 'black' : 'red';
      return {
        winner,
        moves,
        reason: `${turn === 'red' ? '红方' : '黑方'}无合法走法`,
        finalBoard: board,
      };
    }

    const movingPiece = board[best.from.row][best.from.col]!;
    const captured = board[best.to.row][best.to.col] ?? undefined;
    const notation = getNotation(board, best.from, best.to, movingPiece);

    const newBoard = cloneBoard(board);
    newBoard[best.to.row][best.to.col] = newBoard[best.from.row][best.from.col];
    newBoard[best.from.row][best.from.col] = null;
    board = newBoard;

    // 记录将军历史
    const oppColor: Color = turn === 'red' ? 'black' : 'red';
    const isCheck = isInCheck(board, oppColor);
    checkHistory.push({
      from: best.from,
      to: best.to,
      color: turn,
      isCheck,
      pieceType: movingPiece.type,
      boardHashAfter: boardHashWithTurn(board, oppColor),
    });

    const move: AIBattleMove = {
      from: best.from,
      to: best.to,
      piece: { type: movingPiece.type, color: movingPiece.color },
      captured: captured ? { type: captured.type, color: captured.color } : undefined,
      notation,
    };
    moves.push(move);
    moveCount++;

    if (onMove) onMove(board, move, moveCount);

    turn = turn === 'red' ? 'black' : 'red';
  }

  // 超过最大步数，按子力判胜负
  const score = evaluate(board);
  const winner: Color | 'draw' = Math.abs(score) < 100 ? 'draw' : score > 0 ? 'red' : 'black';
  return { winner, moves, reason: '达到最大步数', finalBoard: board };
}

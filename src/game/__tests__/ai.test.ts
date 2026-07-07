import { describe, it, expect } from 'vitest';
import type { Color } from '../types';
import { createInitialBoard, cloneBoard } from '../constants';
import { findBestMove, evaluate, DIFFICULTY_CONFIG, setPersonality, randomPersonality, type MoveHistoryEntry } from '../ai';
import { getLegalMoves } from '../validate';
import { isInCheck } from '../judge';

function applyMove(board: ReturnType<typeof createInitialBoard>, from: { col: number; row: number }, to: { col: number; row: number }) {
  board[to.row][to.col] = board[from.row][from.col];
  board[from.row][from.col] = null;
}

describe('AI 基础', () => {
  it('评估函数对初始局面返回有限值', () => {
    const board = createInitialBoard();
    const score = evaluate(board);
    expect(Number.isFinite(score)).toBe(true);
    expect(Math.abs(score)).toBeLessThan(100000);
  });

  it('各难度配置存在', () => {
    expect(DIFFICULTY_CONFIG.beginner.depth).toBeGreaterThan(0);
    expect(DIFFICULTY_CONFIG.advanced.depth).toBeGreaterThan(0);
    expect(DIFFICULTY_CONFIG.master.depth).toBeGreaterThan(0);
    expect(DIFFICULTY_CONFIG.master.depth).toBeGreaterThanOrEqual(DIFFICULTY_CONFIG.advanced.depth);
  });

  it('AI 在初始局面能返回一个合法走法', () => {
    const board = createInitialBoard();
    const move = findBestMove(board, 'black' as Color, 'beginner');
    expect(move).not.toBeNull();
    if (move) {
      const legal = getLegalMoves(board, move.from);
      const ok = legal.some((m) => m.col === move.to.col && m.row === move.to.row);
      expect(ok).toBe(true);
    }
  });

  it('AI 不会走出送将的着法', () => {
    const board = createInitialBoard();
    for (let i = 0; i < 6; i++) {
      const move = findBestMove(board, (i % 2 === 0 ? 'red' : 'black') as Color, 'advanced');
      if (!move) break;
      applyMove(board, move.from, move.to);
      const moverColor = i % 2 === 0 ? 'red' : 'black';
      expect(isInCheck(board, moverColor as Color)).toBe(false);
    }
  });

  it('大师难度能发现一步将杀（车底杀）', () => {
    const board = createInitialBoard();
    for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) board[r][c] = null;
    board[4][0] = { type: 'king', color: 'black' };
    board[3][0] = { type: 'chariot', color: 'red' };
    board[4][8] = { type: 'king', color: 'red' };
    const move = findBestMove(board, 'red' as Color, 'master');
    expect(move).not.toBeNull();
    if (move) {
      expect(move.to.col).toBe(0);
      expect(move.to.row).toBe(4);
    }
  });

  it('AI 走子后棋盘状态正确更新（不污染原棋盘）', () => {
    const board = createInitialBoard();
    const snapshot = cloneBoard(board);
    findBestMove(board, 'black' as Color, 'beginner');
    expect(board).toEqual(snapshot);
  });

  it('AI 被绝杀（无合法走法）时返回 null 即认输', () => {
    const board = createInitialBoard();
    for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) board[r][c] = null;
    board[0][3] = { type: 'king', color: 'black' };
    board[0][2] = { type: 'chariot', color: 'red' };
    board[0][4] = { type: 'chariot', color: 'red' };
    board[2][3] = { type: 'king', color: 'red' };
    const move = findBestMove(board, 'black' as Color, 'master');
    expect(move).toBeNull();
  });

  it('AI 不会连续将军超过 3 次（同一棋子长将禁止）', () => {
    // 构造一个红车可连续将军黑将的局面，但红车有非将军走法可选
    const board = createInitialBoard();
    for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) board[r][c] = null;
    board[0][3] = { type: 'king', color: 'black' };
    board[2][3] = { type: 'chariot', color: 'red' };
    board[9][0] = { type: 'king', color: 'red' }; // 红王不在同列，避免将帅照面

    // 模拟红车从 (3,2) 连续将军 3 次
    const checkHistory: MoveHistoryEntry[] = [];
    const redChariotPos = { col: 3, row: 2 };
    for (let i = 0; i < 3; i++) {
      checkHistory.push({
        from: redChariotPos,
        to: { col: 3, row: 1 },
        color: 'red' as Color,
        isCheck: true,
        pieceType: 'chariot',
      });
    }
    // 第 4 次同棋子将军应被禁止，AI 应选择非将军走法（如横移）
    const move = findBestMove(board, 'red' as Color, 'master', checkHistory);
    expect(move).not.toBeNull();
    if (move) {
      // 验证：走完后不应将军黑方
      applyMove(board, move.from, move.to);
      const stillCheck = isInCheck(board, 'black' as Color);
      expect(stillCheck).toBe(false);
    }
  });

  it(
    'AI 开局多样化：同一局面多次搜索会产生不同的首步走法',
    () => {
      // 多次从初始局面让 AI 走，统计不同的首步走法数量
      const movesSet = new Set<string>();
      const numTrials = 6;
      for (let i = 0; i < numTrials; i++) {
        const board = createInitialBoard();
        // 每次随机切换性格
        setPersonality(randomPersonality());
        const move = findBestMove(board, 'red' as Color, 'beginner');
        if (move) {
          movesSet.add(`${move.from.col},${move.from.row}->${move.to.col},${move.to.row}`);
        }
      }
      // 至少应有 2 种不同的首步走法（避免千篇一律）
      expect(movesSet.size).toBeGreaterThanOrEqual(2);
    },
    30000,
  );

  it('不同性格产生不同评估值', () => {
    const board = createInitialBoard();
    setPersonality('aggressive');
    const aggScore = evaluate(board);
    setPersonality('defensive');
    const defScore = evaluate(board);
    setPersonality('positional');
    const posScore = evaluate(board);
    // 不同性格的评估值应有差异（不一定完全不同，但至少有一个不同）
    const scores = new Set([aggScore, defScore, posScore]);
    expect(scores.size).toBeGreaterThanOrEqual(2);
  });

  it('黑方也能发现一步将杀（修复黑方选最差走法的 bug）', () => {
    // 构造黑车可一步将杀红帅的局面
    const board = createInitialBoard();
    for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) board[r][c] = null;
    board[5][0] = { type: 'king', color: 'red' };
    board[6][0] = { type: 'chariot', color: 'black' };
    board[5][8] = { type: 'king', color: 'black' };
    const move = findBestMove(board, 'black' as Color, 'master');
    expect(move).not.toBeNull();
    if (move) {
      // 黑车走到红帅位置吃帅
      expect(move.to.col).toBe(0);
      expect(move.to.row).toBe(5);
    }
  });

  it('黑方会吃掉无防护的高价值棋子（不再当傻子）', () => {
    // 红马无防护落在黑车攻击范围内，黑应主动吃马
    const board = createInitialBoard();
    for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) board[r][c] = null;
    board[9][4] = { type: 'king', color: 'black' };
    board[0][4] = { type: 'king', color: 'red' };
    board[5][4] = { type: 'horse', color: 'red' }; // 红马无防护
    board[6][4] = { type: 'chariot', color: 'black' }; // 黑车可吃马
    const move = findBestMove(board, 'black' as Color, 'advanced');
    expect(move).not.toBeNull();
    if (move) {
      expect(move.to.col).toBe(4);
      expect(move.to.row).toBe(5);
    }
  });
});

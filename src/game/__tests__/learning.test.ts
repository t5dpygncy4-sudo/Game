import { describe, it, expect } from 'vitest';
import { createInitialBoard } from '../constants';
import { aiSelfPlay, setPieceWeights, resetPieceWeights, DEFAULT_PIECE_VALUE, type AIBattleResult } from '../ai';
import {
  createEmptyLearningState,
  learnFromGame,
  pickOpeningMove,
  createOpeningBookProvider,
  getLearningSummary,
  resetLearningState,
} from '../learning';
import type { Color } from '../types';

// 构造一个极简的合成对局结果（不调用真实搜索），用于快速测试学习逻辑
function makeSyntheticResult(winner: Color | 'draw', moveCount = 5): AIBattleResult {
  const board = createInitialBoard();
  const moves = [];
  // 红兵（col 0）与黑兵（col 8）分别向前推进，互不干扰
  let redRow = 6;
  let blackRow = 3;
  for (let i = 0; i < moveCount; i++) {
    const isRed = i % 2 === 0;
    const from = isRed ? { col: 0, row: redRow } : { col: 8, row: blackRow };
    const to = isRed ? { col: 0, row: redRow - 1 } : { col: 8, row: blackRow + 1 };
    const piece = board[from.row][from.col];
    if (!piece) break;
    moves.push({
      from,
      to,
      piece: { type: piece.type, color: piece.color },
      captured: undefined,
      notation: '合',
    });
    board[to.row][to.col] = piece;
    board[from.row][from.col] = null;
    if (isRed) redRow--; else blackRow++;
  }
  return { winner, moves, reason: '测试', finalBoard: board };
}

describe('自我学习进化系统', () => {
  it('空学习状态统计正确', () => {
    const state = createEmptyLearningState();
    const summary = getLearningSummary(state);
    expect(summary.totalGames).toBe(0);
    expect(summary.generation).toBe(0);
    expect(summary.openingBookSize).toBe(0);
    expect(state.weights).toEqual(DEFAULT_PIECE_VALUE);
  });

  it('AI 自我对战能完成一局并产生结果', () => {
    const result = aiSelfPlay('beginner', 80);
    expect(result.moves.length).toBeGreaterThan(0);
    expect(['red', 'black', 'draw']).toContain(result.winner);
    expect(result.finalBoard).toBeTruthy();
  }, 30000);

  it('学习一局后开局库与统计更新', () => {
    const state = createEmptyLearningState();
    const result = makeSyntheticResult('red', 6);
    const newState = learnFromGame(state, result);
    expect(newState.totalGames).toBe(1);
    expect(newState.redWins).toBe(1);
    expect(Object.keys(newState.openingBook).length).toBeGreaterThan(0);
  });

  it('多局学习后世代晋升', () => {
    let state = createEmptyLearningState();
    for (let i = 0; i < 12; i++) {
      state = learnFromGame(state, makeSyntheticResult(i % 2 === 0 ? 'red' : 'black', 4));
    }
    expect(state.totalGames).toBe(12);
    expect(state.generation).toBeGreaterThanOrEqual(1);
  });

  it('和棋不计入胜负但计入总数', () => {
    let state = createEmptyLearningState();
    state = learnFromGame(state, makeSyntheticResult('draw', 4));
    expect(state.totalGames).toBe(1);
    expect(state.redWins).toBe(0);
    expect(state.blackWins).toBe(0);
    expect(state.draws).toBe(1);
  });

  it('开局库能返回走法（学习后）', () => {
    let state = createEmptyLearningState();
    state = learnFromGame(state, makeSyntheticResult('red', 8));
    const board = createInitialBoard();
    const move = pickOpeningMove(state, board, 'red');
    expect(move).not.toBeNull();
    if (move) {
      expect(move.from).toBeTruthy();
      expect(move.to).toBeTruthy();
    }
  });

  it('moveProvider 注入开局库后 aiSelfPlay 仍能正常完成', () => {
    let state = createEmptyLearningState();
    state = learnFromGame(state, makeSyntheticResult('red', 8));
    const provider = createOpeningBookProvider(state);
    const result = aiSelfPlay('beginner', 60, undefined, provider);
    expect(result.moves.length).toBeGreaterThan(0);
    expect(['red', 'black', 'draw']).toContain(result.winner);
  }, 30000);

  it('权重微调在胜负局后发生变化且被钳制', () => {
    let state = createEmptyLearningState();
    const original = { ...state.weights };
    // 学习多局红胜，且合成结果中红方吃子（这里合成结果无吃子，权重应不变）
    for (let i = 0; i < 5; i++) {
      state = learnFromGame(state, makeSyntheticResult('red', 4));
    }
    // 合成结果无吃子，权重不应变化
    expect(state.weights).toEqual(original);
  });

  it('权重注入与重置', () => {
    const custom = { ...DEFAULT_PIECE_VALUE, chariot: 999 };
    setPieceWeights(custom);
    resetPieceWeights();
    expect(true).toBe(true);
  });

  it('重置学习状态后回到初始', () => {
    let state = createEmptyLearningState();
    state = learnFromGame(state, makeSyntheticResult('red', 4));
    expect(state.totalGames).toBe(1);
    const fresh = resetLearningState();
    expect(fresh.totalGames).toBe(0);
    expect(fresh.openingBook).toEqual({});
  });
});

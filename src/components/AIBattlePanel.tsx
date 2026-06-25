import { useGameStore } from '@/store/gameStore';
import { getLearningSummary } from '@/game/learning';
import { DEFAULT_PIECE_VALUE } from '@/game/ai';
import type { PieceType } from '@/game/types';
import {
  Brain,
  Dna,
  Play,
  Square,
  RotateCcw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PIECE_LABEL: Record<PieceType, string> = {
  king: '将',
  chariot: '车',
  horse: '马',
  cannon: '炮',
  advisor: '士',
  elephant: '相',
  soldier: '兵',
};

const WEIGHT_ORDER: PieceType[] = ['chariot', 'cannon', 'horse', 'advisor', 'elephant', 'soldier'];

export default function AIBattlePanel() {
  const learning = useGameStore((s) => s.learning);
  const batchRunning = useGameStore((s) => s.batchRunning);
  const batchTotal = useGameStore((s) => s.batchTotal);
  const batchDone = useGameStore((s) => s.batchDone);
  const batchLog = useGameStore((s) => s.batchLog);
  const runSelfPlayBatch = useGameStore((s) => s.runSelfPlayBatch);
  const stopBatch = useGameStore((s) => s.stopBatch);
  const resetLearning = useGameStore((s) => s.resetLearning);

  const summary = getLearningSummary(learning);
  const progress = batchTotal > 0 ? Math.round((batchDone / batchTotal) * 100) : 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gold-500/30 bg-ink-900/40 p-3">
      {/* 标题 */}
      <div className="flex items-center gap-2 text-gold-300">
        <Dna className="h-4 w-4" />
        <span className="font-display text-xs tracking-wider">自我学习进化系统</span>
      </div>

      {/* 世代与统计 */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md bg-ink-800/60 p-2">
          <div className="flex items-center gap-1 text-gold-500/60">
            <Sparkles className="h-3 w-3" />
            <span>世代</span>
          </div>
          <div className="mt-0.5 font-display text-lg text-gold-300">{summary.generation}</div>
        </div>
        <div className="rounded-md bg-ink-800/60 p-2">
          <div className="flex items-center gap-1 text-gold-500/60">
            <Brain className="h-3 w-3" />
            <span>累计对局</span>
          </div>
          <div className="mt-0.5 font-display text-lg text-paper-100">{summary.totalGames}</div>
        </div>
      </div>

      {/* 胜率 */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-cinnabar-400">红方胜率</span>
          <span className="font-mono text-cinnabar-300">
            {(summary.redWinRate * 100).toFixed(0)}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
          <div
            className="h-full rounded-full bg-cinnabar-500 transition-all"
            style={{ width: `${summary.redWinRate * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-jade-300">黑方胜率</span>
          <span className="font-mono text-jade-200">
            {(summary.blackWinRate * 100).toFixed(0)}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
          <div
            className="h-full rounded-full bg-jade-500 transition-all"
            style={{ width: `${summary.blackWinRate * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between pt-0.5 text-[10px] text-paper-200/40">
          <span>和棋 {(summary.drawRate * 100).toFixed(0)}%</span>
          <span>开局库 {summary.openingBookSize} 局面</span>
        </div>
      </div>

      {/* 学习到的权重 */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1 text-[11px] text-gold-500/60">
          <TrendingUp className="h-3 w-3" />
          <span>进化权重（相对默认值）</span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {WEIGHT_ORDER.map((type) => {
            const val = learning.weights[type];
            const base = DEFAULT_PIECE_VALUE[type];
            const delta = ((val - base) / base) * 100;
            const positive = delta >= 0;
            return (
              <div
                key={type}
                className="flex flex-col rounded bg-ink-800/50 px-1.5 py-1 text-center"
              >
                <span className="text-[11px] text-paper-200/70">{PIECE_LABEL[type]}</span>
                <span
                  className={cn(
                    'font-mono text-[10px]',
                    positive ? 'text-cinnabar-300' : 'text-jade-300',
                  )}
                >
                  {positive ? '+' : ''}
                  {delta.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 批量训练控制 */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-widest text-gold-500/60">
          批量自我训练
        </span>
        {!batchRunning ? (
          <div className="grid grid-cols-3 gap-1.5">
            {[5, 10, 20].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => runSelfPlayBatch(n)}
                className="flex items-center justify-center gap-1 rounded-md border border-jade-600/50 bg-jade-700/20 px-1 py-1.5 text-xs font-medium text-jade-200 transition-all hover:border-jade-500 hover:bg-jade-700/40 active:translate-y-0.5"
              >
                <Play className="h-3 w-3" />
                {n} 局
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] text-paper-200/70">
              <span>
                训练中 {batchDone}/{batchTotal}
              </span>
              <span className="font-mono text-gold-300">{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-ink-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold-500 to-cinnabar-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <button
              type="button"
              onClick={stopBatch}
              className="flex items-center justify-center gap-1.5 rounded-md border border-cinnabar-600/50 bg-cinnabar-700/20 px-2 py-1.5 text-xs font-medium text-cinnabar-200 transition-all hover:bg-cinnabar-700/40 active:translate-y-0.5"
            >
              <Square className="h-3 w-3" />
              停止
            </button>
          </div>
        )}
      </div>

      {/* 最近对战记录 */}
      {batchLog.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-widest text-gold-500/60">
            最近对战
          </span>
          <div className="max-h-32 overflow-y-auto rounded-md bg-ink-900/50 p-1.5 text-[11px]">
            {batchLog
              .slice()
              .reverse()
              .map((entry) => (
                <div
                  key={entry.index}
                  className="flex items-center justify-between border-b border-ink-700/40 py-0.5 last:border-0"
                >
                  <span className="text-paper-200/50">#{entry.index}</span>
                  <span
                    className={cn(
                      'font-medium',
                      entry.winner === 'red'
                        ? 'text-cinnabar-300'
                        : entry.winner === 'black'
                          ? 'text-jade-300'
                          : 'text-paper-200/50',
                    )}
                  >
                    {entry.winner === 'red' ? '红胜' : entry.winner === 'black' ? '黑胜' : '和棋'}
                  </span>
                  <span className="text-paper-200/40">{entry.moves}步</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 重置学习 */}
      <button
        type="button"
        onClick={() => {
          if (confirm('确定要重置全部学习数据吗？此操作不可撤销。')) {
            resetLearning();
          }
        }}
        className="flex items-center justify-center gap-1.5 rounded-md border border-ink-500/60 px-2 py-1.5 text-[11px] text-paper-200/50 transition-all hover:border-cinnabar-500/50 hover:text-cinnabar-300"
      >
        <RotateCcw className="h-3 w-3" />
        重置学习数据
      </button>

      <p className="text-[10px] leading-relaxed text-paper-200/30">
        AI 通过自我对战积累开局库、微调棋子权重，每 {10} 局晋升一个世代，学习率随世代衰减。数据保存在本地浏览器。
      </p>
    </div>
  );
}

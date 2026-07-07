import { useGameStore } from '@/store/gameStore';
import { PERSONALITIES } from '@/game/ai';
import { Loader2, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function StatusBar() {
  const turn = useGameStore((s) => s.turn);
  const status = useGameStore((s) => s.status);
  const history = useGameStore((s) => s.history);
  const mode = useGameStore((s) => s.mode);
  const playerColor = useGameStore((s) => s.playerColor);
  const aiThinking = useGameStore((s) => s.aiThinking);
  const personality = useGameStore((s) => s.personality);

  const finished = status === 'redWin' || status === 'blackWin';
  const isCheck = status === 'check';

  const turnLabel = turn === 'red' ? '红方' : '黑方';
  const turnColor = turn === 'red' ? 'text-cinnabar-400' : 'text-jade-300';

  let resultText = '';
  if (status === 'redWin') resultText = '红方胜';
  if (status === 'blackWin') resultText = '黑方胜';

  const aiTurn = (mode === 'pve' && turn !== playerColor) || mode === 'aiva';
  const showPersonality = (mode === 'pve' || mode === 'aiva') && PERSONALITIES[personality];

  return (
    <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-ink-600/60 bg-ink-800/70 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'inline-block h-3 w-3 rounded-full transition-colors',
            finished ? 'bg-gold-400' : aiThinking ? 'bg-cinnabar-400' : turn === 'red' ? 'bg-cinnabar-500' : 'bg-jade-500',
            !finished && !aiThinking && 'animate-pulse',
            aiThinking && 'animate-pulse',
          )}
        />
        <div className="flex flex-col leading-tight">
          <span className="text-[11px] uppercase tracking-widest text-gold-500/70">行棋方</span>
          <span className={cn('flex items-center gap-1.5 font-display text-lg', finished ? 'text-gold-300' : turnColor)}>
            {finished ? (
              resultText
            ) : aiThinking ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                AI 思考中
              </>
            ) : (
              <>
                {aiTurn && <Cpu className="h-4 w-4" />}
                {turnLabel}
                {aiTurn && '（AI）'}
              </>
            )}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {showPersonality && (
          <span
            className="rounded-md bg-gold-500/15 px-2.5 py-1 text-xs font-medium text-gold-300 ring-1 ring-gold-500/30"
            title="AI 当前性格"
          >
            {PERSONALITIES[personality].name}
          </span>
        )}
        {isCheck && !finished && (
          <span className="animate-slide-up rounded-md bg-cinnabar-600/30 px-3 py-1 text-sm font-bold text-cinnabar-400 ring-1 ring-cinnabar-500/50">
            将军！
          </span>
        )}
        <span className="rounded-md bg-ink-700/60 px-3 py-1 text-sm text-paper-200/80">
          第 {Math.floor(history.length / 2) + 1} 回合
        </span>
      </div>
    </div>
  );
}

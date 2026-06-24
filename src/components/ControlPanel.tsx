import { useGameStore } from '@/store/gameStore';
import { RotateCcw, Undo2, FlipHorizontal2, BookOpen, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ControlPanelProps {
  onOpenRules: () => void;
}

export default function ControlPanel({ onOpenRules }: ControlPanelProps) {
  const newGame = useGameStore((s) => s.newGame);
  const undo = useGameStore((s) => s.undo);
  const flipBoard = useGameStore((s) => s.flipBoard);
  const history = useGameStore((s) => s.history);
  const status = useGameStore((s) => s.status);

  const finished = status === 'redWin' || status === 'blackWin';

  const buttons = [
    {
      label: '新局',
      icon: RotateCcw,
      onClick: newGame,
      primary: true,
    },
    {
      label: '悔棋',
      icon: Undo2,
      onClick: undo,
      disabled: history.length === 0,
    },
    {
      label: '翻转',
      icon: FlipHorizontal2,
      onClick: flipBoard,
    },
    {
      label: '规则',
      icon: BookOpen,
      onClick: onOpenRules,
    },
  ];

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-ink-600/60 bg-ink-800/70 p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-gold-500/80">
        <Trophy className="h-4 w-4" />
        <span className="font-display text-sm tracking-wider">对局控制</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {buttons.map(({ label, icon: Icon, onClick, primary, disabled }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
              'disabled:cursor-not-allowed disabled:opacity-35',
              primary
                ? 'bg-cinnabar-600 text-paper-50 shadow-[0_3px_0_#7a2018] hover:bg-cinnabar-500 active:translate-y-0.5 active:shadow-[0_1px_0_#7a2018]'
                : 'border border-ink-500/70 bg-ink-700/50 text-paper-100 hover:border-gold-500/50 hover:bg-ink-600/60 active:translate-y-0.5',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
      {finished && (
        <button
          type="button"
          onClick={newGame}
          className="animate-slide-up rounded-lg bg-gold-500 px-3 py-2.5 text-sm font-bold text-ink-900 shadow-[0_3px_0_#8a6f3a] transition-all hover:bg-gold-400 active:translate-y-0.5"
        >
          再来一局
        </button>
      )}
    </div>
  );
}

import { useGameStore } from '@/store/gameStore';
import type { Difficulty } from '@/game/ai';
import type { Color } from '@/game/types';
import {
  RotateCcw,
  Undo2,
  FlipHorizontal2,
  BookOpen,
  Trophy,
  Volume2,
  VolumeX,
  Users,
  Cpu,
  Loader2,
  Swords,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ControlPanelProps {
  onOpenRules: () => void;
}

const DIFFICULTIES: { value: Difficulty; label: string; desc: string }[] = [
  { value: 'beginner', label: '初级', desc: '浅搜·偶有失误' },
  { value: 'advanced', label: '高级', desc: '中搜·稳健' },
  { value: 'master', label: '大师', desc: '深搜·凌厉' },
];

const SIDES: { value: Color; label: string; icon: typeof Swords }[] = [
  { value: 'red', label: '执红', icon: Swords },
  { value: 'black', label: '执黑', icon: Shield },
];

export default function ControlPanel({ onOpenRules }: ControlPanelProps) {
  const newGame = useGameStore((s) => s.newGame);
  const undo = useGameStore((s) => s.undo);
  const flipBoard = useGameStore((s) => s.flipBoard);
  const history = useGameStore((s) => s.history);
  const status = useGameStore((s) => s.status);
  const mode = useGameStore((s) => s.mode);
  const playerColor = useGameStore((s) => s.playerColor);
  const difficulty = useGameStore((s) => s.difficulty);
  const muted = useGameStore((s) => s.muted);
  const aiThinking = useGameStore((s) => s.aiThinking);
  const setMode = useGameStore((s) => s.setMode);
  const setPlayerColor = useGameStore((s) => s.setPlayerColor);
  const setDifficulty = useGameStore((s) => s.setDifficulty);
  const toggleMute = useGameStore((s) => s.toggleMute);

  const finished = status === 'redWin' || status === 'blackWin';

  const actionButtons = [
    { label: '新局', icon: RotateCcw, onClick: newGame, primary: true },
    { label: '悔棋', icon: Undo2, onClick: undo, disabled: history.length === 0 || aiThinking },
    { label: '翻转', icon: FlipHorizontal2, onClick: flipBoard },
    { label: '规则', icon: BookOpen, onClick: onOpenRules },
  ];

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-ink-600/60 bg-ink-800/70 p-4 backdrop-blur">
      <div className="flex items-center justify-between text-gold-500/80">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4" />
          <span className="font-display text-sm tracking-wider">对局控制</span>
        </div>
        <button
          type="button"
          onClick={toggleMute}
          className="rounded-md p-1.5 text-paper-200/70 transition-colors hover:bg-ink-600 hover:text-gold-300"
          title={muted ? '开启声音' : '静音'}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>

      {/* 模式切换 */}
      <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-ink-900/50 p-1">
        <button
          type="button"
          onClick={() => setMode('pvp')}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-all',
            mode === 'pvp'
              ? 'bg-cinnabar-600 text-paper-50 shadow'
              : 'text-paper-200/60 hover:text-paper-100',
          )}
        >
          <Users className="h-3.5 w-3.5" />
          双人对弈
        </button>
        <button
          type="button"
          onClick={() => setMode('pve')}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-all',
            mode === 'pve'
              ? 'bg-cinnabar-600 text-paper-50 shadow'
              : 'text-paper-200/60 hover:text-paper-100',
          )}
        >
          <Cpu className="h-3.5 w-3.5" />
          人机对战
        </button>
      </div>

      {/* 难度选择（仅人机模式） */}
      {mode === 'pve' && (
        <div className="flex flex-col gap-1.5 animate-slide-up">
          <span className="text-[11px] uppercase tracking-widest text-gold-500/60">执子选择</span>
          <div className="grid grid-cols-2 gap-1.5">
            {SIDES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setPlayerColor(value)}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-all',
                  playerColor === value
                    ? value === 'red'
                      ? 'bg-cinnabar-600 text-paper-50 shadow'
                      : 'bg-ink-600 text-paper-100 shadow ring-1 ring-paper-200/30'
                    : 'border border-ink-500/60 bg-ink-700/40 text-paper-200/70 hover:border-gold-500/40',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
          <span className="text-[11px] uppercase tracking-widest text-gold-500/60">AI 难度</span>
          <div className="grid grid-cols-3 gap-1.5">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setDifficulty(d.value)}
                title={d.desc}
                className={cn(
                  'rounded-md px-1 py-1.5 text-xs font-medium transition-all',
                  difficulty === d.value
                    ? 'bg-gold-500 text-ink-900 shadow'
                    : 'border border-ink-500/60 bg-ink-700/40 text-paper-200/70 hover:border-gold-500/40',
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
          {aiThinking && (
            <div className="flex items-center gap-2 rounded-md bg-cinnabar-600/15 px-2 py-1.5 text-xs text-cinnabar-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              AI 正在思考…
            </div>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="grid grid-cols-2 gap-2.5">
        {actionButtons.map(({ label, icon: Icon, onClick, primary, disabled }) => (
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

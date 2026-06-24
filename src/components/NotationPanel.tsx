import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function NotationPanel() {
  const history = useGameStore((s) => s.history);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history.length]);

  const rounds: { index: number; red?: string; black?: string }[] = [];
  for (let i = 0; i < history.length; i += 2) {
    rounds.push({
      index: rounds.length + 1,
      red: history[i]?.notation,
      black: history[i + 1]?.notation,
    });
  }
  if (rounds.length === 0) {
    rounds.push({ index: 1 });
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-ink-600/60 bg-ink-800/70 p-4 backdrop-blur">
      <div className="flex items-center justify-between text-gold-500/80">
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4" />
          <span className="font-display text-sm tracking-wider">着法记录</span>
        </div>
        <span className="text-xs text-paper-200/50">{history.length} 步</span>
      </div>

      <div
        ref={scrollRef}
        className="scroll-thin max-h-[260px] min-h-[120px] overflow-y-auto pr-1 lg:max-h-[420px]"
      >
        <table className="w-full border-collapse text-sm">
          <tbody>
            {rounds.map((r) => (
              <tr key={r.index} className="border-b border-ink-600/40 last:border-0">
                <td className="w-8 py-1.5 pr-2 text-right text-xs text-gold-500/60">{r.index}.</td>
                <td className="py-1.5 pr-2">
                  {r.red ? (
                    <span className="font-kai text-cinnabar-400">{r.red}</span>
                  ) : (
                    <span className="text-paper-200/30">—</span>
                  )}
                </td>
                <td className="py-1.5">
                  {r.black ? (
                    <span className="font-kai text-paper-100">{r.black}</span>
                  ) : (
                    <span className="text-paper-200/30">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {history.length === 0 && (
        <p className={cn('text-center text-xs text-paper-200/40')}>
          红方先行，点击棋子开始对弈
        </p>
      )}
    </div>
  );
}

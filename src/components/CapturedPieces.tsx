import { useGameStore } from '@/store/gameStore';
import { PIECE_CHARS } from '@/game/constants';
import type { Color, PieceType } from '@/game/types';
import { Skull } from 'lucide-react';

const ORDER: PieceType[] = ['chariot', 'horse', 'cannon', 'elephant', 'advisor', 'soldier'];

export default function CapturedPieces() {
  const history = useGameStore((s) => s.history);

  const captured: Record<Color, PieceType[]> = { red: [], black: [] };
  for (const move of history) {
    if (move.captured) {
      captured[move.captured.color].push(move.captured.type);
    }
  }

  const renderSide = (color: Color, label: string, accent: string) => {
    const list = captured[color].slice().sort(
      (a, b) => ORDER.indexOf(a) - ORDER.indexOf(b),
    );
    return (
      <div className="flex flex-col gap-1.5">
        <span className={`text-xs ${accent}`}>{label}（{list.length}）</span>
        <div className="flex min-h-[28px] flex-wrap gap-1">
          {list.length === 0 ? (
            <span className="text-xs text-paper-200/30">—</span>
          ) : (
            list.map((t, i) => (
              <span
                key={i}
                className="flex h-6 w-6 items-center justify-center rounded-full border border-ink-500/60 bg-paper-100/90 font-kai text-xs text-ink-800 opacity-80"
              >
                {PIECE_CHARS[color][t]}
              </span>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-ink-600/60 bg-ink-800/70 p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-gold-500/80">
        <Skull className="h-4 w-4" />
        <span className="font-display text-sm tracking-wider">阵亡棋子</span>
      </div>
      <div className="flex flex-col gap-3">
        {renderSide('black', '黑方损失', 'text-paper-100/70')}
        <div className="h-px bg-ink-600/50" />
        {renderSide('red', '红方损失', 'text-cinnabar-400/80')}
      </div>
    </div>
  );
}

import type { Piece as PieceType } from '@/game/types';
import { PIECE_CHARS } from '@/game/constants';
import { cn } from '@/lib/utils';

interface PieceProps {
  piece: PieceType;
  selected?: boolean;
  inCheck?: boolean;
}

export default function Piece({ piece, selected, inCheck }: PieceProps) {
  const char = PIECE_CHARS[piece.color][piece.type];
  const isRed = piece.color === 'red';

  return (
    <div
      className={cn(
        'relative flex h-full w-full items-center justify-center rounded-full transition-transform duration-150',
        selected && 'scale-110',
      )}
    >
      {/* 选中/将军光环 */}
      {(selected || inCheck) && (
        <span
          className={cn(
            'absolute inset-0 rounded-full',
            inCheck
              ? 'bg-cinnabar-500/30 ring-2 ring-cinnabar-400 animate-pulse-ring'
              : 'ring-2 ring-gold-400 shadow-[0_0_14px_rgba(212,175,82,0.7)]',
          )}
        />
      )}

      {/* 棋子主体 */}
      <div
        className={cn(
          'relative flex h-[86%] w-[86%] items-center justify-center rounded-full',
          isRed ? 'shadow-piece-red' : 'shadow-piece',
        )}
        style={{
          background:
            'radial-gradient(circle at 34% 28%, #fff8e7 0%, #f3e3bd 45%, #e3cd96 100%)',
          border: isRed ? '2px solid #b5392b' : '2px solid #2a2622',
        }}
      >
        {/* 内圈 */}
        <span
          className="absolute inset-[3px] rounded-full"
          style={{
            border: isRed ? '1.5px solid #c0392b' : '1.5px solid #3a3530',
            opacity: 0.85,
          }}
        />
        {/* 高光 */}
        <span
          className="absolute left-[18%] top-[12%] h-[30%] w-[34%] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.7), transparent 70%)',
          }}
        />
        {/* 文字 */}
        <span
          className={cn('piece-char relative z-10 leading-none', isRed ? 'text-cinnabar-600' : 'text-ink-800')}
          style={{ fontSize: 'clamp(14px, 4.2vw, 30px)' }}
        >
          {char}
        </span>
      </div>
    </div>
  );
}

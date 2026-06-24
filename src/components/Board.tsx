import { useGameStore } from '@/store/gameStore';
import { findKing } from '@/game/constants';
import type { Position } from '@/game/types';
import { CELL, displayCoord, px, py, VIEW_H, VIEW_W } from './boardGeometry';
import BoardGrid from './BoardGrid';
import Piece from './Piece';

const CELL_W = (CELL / VIEW_W) * 100;
const CELL_H = (CELL / VIEW_H) * 100;

function samePos(a: Position | null, b: Position): boolean {
  return !!a && a.col === b.col && a.row === b.row;
}

export default function Board() {
  const board = useGameStore((s) => s.board);
  const selected = useGameStore((s) => s.selected);
  const legalMoves = useGameStore((s) => s.legalMoves);
  const lastMove = useGameStore((s) => s.lastMove);
  const flipped = useGameStore((s) => s.flipped);
  const status = useGameStore((s) => s.status);
  const turn = useGameStore((s) => s.turn);
  const onCellClick = useGameStore((s) => s.onCellClick);

  const checkKing = status === 'check' ? findKing(board, turn) : null;

  const cells: { col: number; row: number }[] = [];
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 9; col++) {
      cells.push({ col, row });
    }
  }

  return (
    <div
      className="paper-texture relative shadow-board"
      style={{
        aspectRatio: `${VIEW_W} / ${VIEW_H}`,
        width: `min(92vw, 640px, calc((100vh - 200px) * ${VIEW_W} / ${VIEW_H}))`,
        maxWidth: '100%',
      }}
    >
      <BoardGrid />

      {cells.map(({ col, row }) => {
        const d = displayCoord(col, row, flipped);
        const piece = board[row][col];
        const isSelected = samePos(selected, { col, row });
        const isLegal = legalMoves.some((m) => m.col === col && m.row === row);
        const isLastFrom = samePos(lastMove?.from ?? null, { col, row });
        const isLastTo = samePos(lastMove?.to ?? null, { col, row });
        const isCheckKing = !!checkKing && checkKing.col === col && checkKing.row === row;

        return (
          <button
            key={`${col}-${row}`}
            type="button"
            onClick={() => onCellClick({ col, row })}
            className="absolute flex items-center justify-center"
            style={{
              left: `${px(d.col)}%`,
              top: `${py(d.row)}%`,
              width: `${CELL_W}%`,
              height: `${CELL_H}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* 上一步落点高亮 */}
            {(isLastFrom || isLastTo) && (
              <span className="absolute inset-[8%] rounded-full bg-gold-400/25 ring-1 ring-gold-400/50" />
            )}

            {/* 合法落点提示 */}
            {isLegal && !piece && (
              <span className="absolute h-[26%] w-[26%] rounded-full bg-jade-500/70 shadow-[0_0_8px_rgba(63,107,92,0.6)] animate-pop-in" />
            )}
            {isLegal && piece && (
              <span className="absolute inset-[2%] rounded-full ring-[3px] ring-jade-400 ring-offset-0 animate-pulse-ring" />
            )}

            {/* 棋子 */}
            {piece && (
              <div className="relative h-[88%] w-[88%]">
                <Piece piece={piece} selected={isSelected} inCheck={isCheckKing} />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

import { useGameStore } from '@/store/gameStore';
import { findKing } from '@/game/constants';
import type { Position } from '@/game/types';
import { CELL, displayCoord, px, py, vx, vy, VIEW_H, VIEW_W } from './boardGeometry';
import BoardGrid from './BoardGrid';
import Piece from './Piece';

const CELL_W = (CELL / VIEW_W) * 100;
const CELL_H = (CELL / VIEW_H) * 100;

function samePos(a: Position | null, b: Position): boolean {
  return !!a && a.col === b.col && a.row === b.row;
}

function MoveTrail({ lastMove, flipped }: { lastMove: { from: Position; to: Position }; flipped: boolean }) {
  const from = displayCoord(lastMove.from.col, lastMove.from.row, flipped);
  const to = displayCoord(lastMove.to.col, lastMove.to.row, flipped);
  const x1 = vx(from.col);
  const y1 = vy(from.row);
  const x2 = vx(to.col);
  const y2 = vy(to.row);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const arrowLen = 10;
  const arrowAngle = Math.PI / 7;
  const ux = dx / len;
  const uy = dy / len;
  const ax1 = x2 - arrowLen * (ux * Math.cos(arrowAngle) - uy * Math.sin(arrowAngle));
  const ay1 = y2 - arrowLen * (uy * Math.cos(arrowAngle) + ux * Math.sin(arrowAngle));
  const ax2 = x2 - arrowLen * (ux * Math.cos(arrowAngle) + uy * Math.sin(arrowAngle));
  const ay2 = y2 - arrowLen * (uy * Math.cos(arrowAngle) - ux * Math.sin(arrowAngle));

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
    >
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke="rgba(212,175,82,0.55)"
        strokeWidth={2.5}
        strokeDasharray="6 4"
        strokeLinecap="round"
      >
        <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1s" repeatCount="indefinite" />
      </line>
      <polygon
        points={`${x2},${y2} ${ax1},${ay1} ${ax2},${ay2}`}
        fill="rgba(212,175,82,0.7)"
      />
    </svg>
  );
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

      {lastMove && <MoveTrail lastMove={lastMove} flipped={flipped} />}

      {cells.map(({ col, row }) => {
        const d = displayCoord(col, row, flipped);
        const piece = board[row][col];
        const isSelected = samePos(selected, { col, row });
        const isLegal = legalMoves.some((m) => m.col === col && m.row === row);
        const isLastFrom = samePos(lastMove?.from ?? null, { col, row });
        const isLastTo = samePos(lastMove?.to ?? null, { col, row });
        const isCheckKing = !!checkKing && checkKing.col === col && checkKing.row === row;
        const justMoved = isLastTo && !!piece;

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
              <div
                className="relative h-[88%] w-[88%]"
                style={justMoved ? { animation: 'slide-in 0.28s ease-out' } : undefined}
              >
                <Piece piece={piece} selected={isSelected} inCheck={isCheckKing} />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

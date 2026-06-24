import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { findKing } from '@/game/constants';
import type { Move, Position } from '@/game/types';
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
  const arrowLen = 14;
  const arrowAngle = Math.PI / 6;
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
      style={{ zIndex: 20 }}
    >
      <defs>
        <filter id="trail-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke="rgba(255,180,40,0.35)"
        strokeWidth={12}
        strokeLinecap="round"
      />
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke="rgba(255,210,80,0.8)"
        strokeWidth={3.5}
        strokeDasharray="8 5"
        strokeLinecap="round"
        filter="url(#trail-glow)"
      >
        <animate attributeName="stroke-dashoffset" from="0" to="-26" dur="0.8s" repeatCount="indefinite" />
      </line>
      <polygon
        points={`${x2},${y2} ${ax1},${ay1} ${ax2},${ay2}`}
        fill="rgba(255,210,80,0.9)"
        filter="url(#trail-glow)"
      />
    </svg>
  );
}

interface AnimState {
  move: Move;
  phase: 'slide' | 'done';
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

  const [anim, setAnim] = useState<AnimState | null>(null);
  const prevMoveRef = useRef<Move | null>(null);
  const rafRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useLayoutEffect(() => {
    if (lastMove && lastMove !== prevMoveRef.current) {
      prevMoveRef.current = lastMove;
      cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
      setAnim({ move: lastMove, phase: 'slide' });
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => {
          setAnim((a) => (a ? { ...a, phase: 'done' } : null));
        });
      });
      timerRef.current = setTimeout(() => setAnim(null), 400);
    }
  }, [lastMove]);

  const cells: { col: number; row: number }[] = [];
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 9; col++) {
      cells.push({ col, row });
    }
  }

  const animFrom = anim ? displayCoord(anim.move.from.col, anim.move.from.row, flipped) : null;
  const animTo = anim ? displayCoord(anim.move.to.col, anim.move.to.row, flipped) : null;
  const animPiece = anim?.move.piece;

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
        const hidePiece = anim !== null && samePos(anim.move.to, { col, row });

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
            {(isLastFrom || isLastTo) && (
              <span className="absolute inset-[8%] rounded-full bg-gold-400/25 ring-1 ring-gold-400/50" />
            )}

            {isLegal && !piece && (
              <span className="absolute h-[26%] w-[26%] rounded-full bg-jade-500/70 shadow-[0_0_8px_rgba(63,107,92,0.6)] animate-pop-in" />
            )}
            {isLegal && piece && (
              <span className="absolute inset-[2%] rounded-full ring-[3px] ring-jade-400 ring-offset-0 animate-pulse-ring" />
            )}

            {piece && !hidePiece && (
              <div className="relative h-[88%] w-[88%]">
                <Piece piece={piece} selected={isSelected} inCheck={isCheckKing} />
              </div>
            )}
          </button>
        );
      })}

      {lastMove && <MoveTrail lastMove={lastMove} flipped={flipped} />}

      {anim && animPiece && animFrom && animTo && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: `${anim.phase === 'slide' ? px(animFrom.col) : px(animTo.col)}%`,
            top: `${anim.phase === 'slide' ? py(animFrom.row) : py(animTo.row)}%`,
            width: `${CELL_W}%`,
            height: `${CELL_H}%`,
            transform: 'translate(-50%, -50%)',
            transition: anim.phase === 'slide' ? 'none' : 'left 0.28s ease-out, top 0.28s ease-out',
            zIndex: 30,
          }}
        >
          <div className="flex h-full w-full items-center justify-center">
            <div className="relative h-[88%] w-[88%]">
              <Piece piece={animPiece} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

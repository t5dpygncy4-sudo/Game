import { CELL, PAD, vx, vy, VIEW_H, VIEW_W } from './boardGeometry';

const MARKED_POSITIONS: { col: number; row: number }[] = [
  { col: 1, row: 2 },
  { col: 7, row: 2 },
  { col: 1, row: 7 },
  { col: 7, row: 7 },
  { col: 0, row: 3 },
  { col: 2, row: 3 },
  { col: 4, row: 3 },
  { col: 6, row: 3 },
  { col: 8, row: 3 },
  { col: 0, row: 6 },
  { col: 2, row: 6 },
  { col: 4, row: 6 },
  { col: 6, row: 6 },
  { col: 8, row: 6 },
];

const GAP = 5;
const ARM = 9;

function bracketLines(col: number, row: number): { x1: number; y1: number; x2: number; y2: number }[] {
  const x = vx(col);
  const y = vy(row);
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const corners = [
    { dx: -1, dy: -1, skip: col === 0 },
    { dx: 1, dy: -1, skip: col === 8 },
    { dx: -1, dy: 1, skip: col === 0 },
    { dx: 1, dy: 1, skip: col === 8 },
  ];
  for (const { dx, dy, skip } of corners) {
    if (skip) continue;
    const cx = x + dx * GAP;
    const cy = y + dy * GAP;
    lines.push({ x1: cx, y1: cy, x2: cx + dx * ARM, y2: cy });
    lines.push({ x1: cx, y1: cy, x2: cx, y2: cy + dy * ARM });
  }
  return lines;
}

export default function BoardGrid() {
  const horizontalLines = Array.from({ length: 10 }, (_, row) => vy(row));
  const verticalLines = Array.from({ length: 9 }, (_, col) => vx(col));

  const allBrackets = MARKED_POSITIONS.flatMap((p) => bracketLines(p.col, p.row));

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* 外框 */}
      <rect
        x={PAD - 8}
        y={PAD - 8}
        width={8 * CELL + 16}
        height={9 * CELL + 16}
        rx={6}
        fill="none"
        stroke="#3a2a18"
        strokeWidth={3}
      />
      <rect
        x={PAD - 3}
        y={PAD - 3}
        width={8 * CELL + 6}
        height={9 * CELL + 6}
        fill="none"
        stroke="#5a4326"
        strokeWidth={1.5}
      />

      {/* 横线 */}
      {horizontalLines.map((y, i) => (
        <line key={`h-${i}`} x1={vx(0)} y1={y} x2={vx(8)} y2={y} stroke="#4a3520" strokeWidth={1.4} />
      ))}

      {/* 竖线：左右两条贯通，中间七条在楚河处断开 */}
      {verticalLines.map((x, col) => {
        if (col === 0 || col === 8) {
          return <line key={`v-${col}`} x1={x} y1={vy(0)} x2={x} y2={vy(9)} stroke="#4a3520" strokeWidth={1.4} />;
        }
        return (
          <g key={`v-${col}`}>
            <line x1={x} y1={vy(0)} x2={x} y2={vy(4)} stroke="#4a3520" strokeWidth={1.4} />
            <line x1={x} y1={vy(5)} x2={x} y2={vy(9)} stroke="#4a3520" strokeWidth={1.4} />
          </g>
        );
      })}

      {/* 九宫斜线 */}
      <line x1={vx(3)} y1={vy(0)} x2={vx(5)} y2={vy(2)} stroke="#4a3520" strokeWidth={1.4} />
      <line x1={vx(5)} y1={vy(0)} x2={vx(3)} y2={vy(2)} stroke="#4a3520" strokeWidth={1.4} />
      <line x1={vx(3)} y1={vy(7)} x2={vx(5)} y2={vy(9)} stroke="#4a3520" strokeWidth={1.4} />
      <line x1={vx(5)} y1={vy(7)} x2={vx(3)} y2={vy(9)} stroke="#4a3520" strokeWidth={1.4} />

      {/* 兵炮位置标记 */}
      {allBrackets.map((l, i) => (
        <line key={`b-${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#4a3520" strokeWidth={1.4} strokeLinecap="round" />
      ))}

      {/* 楚河汉界 */}
      <text
        x={vx(1.6)}
        y={vy(4.5)}
        fill="#6b4a28"
        fontSize={32}
        fontFamily='"ZCOOL XiaoWei", "STKaiti", "KaiTi", "楷体", serif'
        letterSpacing={12}
        textAnchor="middle"
        dominantBaseline="central"
        opacity={0.8}
      >
        楚 河
      </text>
      <text
        x={vx(6.4)}
        y={vy(4.5)}
        fill="#6b4a28"
        fontSize={32}
        fontFamily='"ZCOOL XiaoWei", "STKaiti", "KaiTi", "楷体", serif'
        letterSpacing={12}
        textAnchor="middle"
        dominantBaseline="central"
        opacity={0.8}
      >
        汉 界
      </text>
    </svg>
  );
}

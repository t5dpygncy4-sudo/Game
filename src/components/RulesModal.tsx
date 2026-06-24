import { X } from 'lucide-react';
import { PIECE_CHARS } from '@/game/constants';
import type { PieceType } from '@/game/types';

interface RulesModalProps {
  open: boolean;
  onClose: () => void;
}

const RULES: { type: PieceType; red: string; black: string; desc: string }[] = [
  { type: 'king', red: PIECE_CHARS.red.king, black: PIECE_CHARS.black.king, desc: '九宫内每步横或竖走一格，不可斜走；双将同列无子相隔则「飞将」可互吃。' },
  { type: 'advisor', red: PIECE_CHARS.red.advisor, black: PIECE_CHARS.black.advisor, desc: '九宫内每步沿斜线走一格。' },
  { type: 'elephant', red: PIECE_CHARS.red.elephant, black: PIECE_CHARS.black.elephant, desc: '走「田」字（斜两格），不可过河；田心有子则「塞象眼」不可走。' },
  { type: 'horse', red: PIECE_CHARS.red.horse, black: PIECE_CHARS.black.horse, desc: '走「日」字；直行方向第一步有子则「蹩马腿」不可走。' },
  { type: 'chariot', red: PIECE_CHARS.red.chariot, black: PIECE_CHARS.black.chariot, desc: '沿横线或纵线直走任意步，遇子则止，可吃对方子。' },
  { type: 'cannon', red: PIECE_CHARS.red.cannon, black: PIECE_CHARS.black.cannon, desc: '不吃子时同车走法；吃子时须翻越恰好一个棋子（炮架）。' },
  { type: 'soldier', red: PIECE_CHARS.red.soldier, black: PIECE_CHARS.black.soldier, desc: '未过河每步向前一格；过河后可向前或左右一格，不可后退。' },
];

export default function RulesModal({ open, onClose }: RulesModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="scroll-thin max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gold-500/30 bg-ink-800 p-6 shadow-board"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl text-gold-300">象棋规则速查</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-paper-200/60 transition-colors hover:bg-ink-600 hover:text-paper-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2.5">
          {RULES.map((r) => (
            <div
              key={r.type}
              className="flex items-start gap-3 rounded-lg border border-ink-600/50 bg-ink-700/40 p-3"
            >
              <div className="flex shrink-0 gap-1.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-cinnabar-500/60 bg-paper-100 font-kai text-lg text-cinnabar-600">
                  {r.red}
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-500 bg-paper-100 font-kai text-lg text-ink-800">
                  {r.black}
                </span>
              </div>
              <p className="pt-1 text-sm leading-relaxed text-paper-100/85">{r.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-1.5 rounded-lg border border-gold-500/20 bg-gold-500/5 p-4 text-sm text-paper-100/80">
          <p className="font-display text-gold-300">胜负判定</p>
          <p>· <span className="text-cinnabar-400">将死</span>：被将军且无任何走法解将，判负。</p>
          <p>· <span className="text-cinnabar-400">困毙</span>：轮到走棋却无任何合法走法，判负。</p>
          <p>· <span className="text-cinnabar-400">飞将</span>：双将同列且中间无子，可被直接飞吃。</p>
          <p>· 红方先行，双方交替行棋。</p>
        </div>
      </div>
    </div>
  );
}

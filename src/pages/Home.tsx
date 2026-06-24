import { useState } from 'react';
import Board from '@/components/Board';
import StatusBar from '@/components/StatusBar';
import ControlPanel from '@/components/ControlPanel';
import NotationPanel from '@/components/NotationPanel';
import CapturedPieces from '@/components/CapturedPieces';
import RulesModal from '@/components/RulesModal';

export default function Home() {
  const [rulesOpen, setRulesOpen] = useState(false);

  return (
    <div className="min-h-screen w-full">
      {/* 标题 */}
      <header className="px-4 pt-6 text-center lg:pt-8">
        <h1 className="font-kai text-4xl tracking-[0.3em] text-gold-300 drop-shadow-[0_2px_8px_rgba(201,169,97,0.3)] lg:text-5xl">
          中國象棋
        </h1>
        <p className="mt-1 font-display text-sm tracking-[0.4em] text-paper-200/50">
          楚 河 漢 界 · 纵 横 十 九
        </p>
      </header>

      {/* 主体布局 */}
      <main className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-4 py-6 lg:flex-row lg:items-start lg:justify-center lg:gap-6">
        {/* 左栏：控制 + 阵亡 */}
        <aside className="order-2 flex w-full max-w-md flex-col gap-4 lg:order-1 lg:w-64">
          <ControlPanel onOpenRules={() => setRulesOpen(true)} />
          <CapturedPieces />
        </aside>

        {/* 中栏：状态 + 棋盘 */}
        <section className="order-1 flex w-full max-w-md flex-col items-center gap-4 lg:order-2 lg:w-auto">
          <div className="w-full max-w-[640px]">
            <StatusBar />
          </div>
          <Board />
        </section>

        {/* 右栏：记谱 */}
        <aside className="order-3 flex w-full max-w-md flex-col gap-4 lg:w-72">
          <NotationPanel />
        </aside>
      </main>

      <footer className="pb-6 text-center text-xs text-paper-200/30">
        严格遵循中国象棋竞赛规则 · 红先黑后
      </footer>

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}

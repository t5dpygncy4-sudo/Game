import { useState } from 'react';
import Board from '@/components/Board';
import StatusBar from '@/components/StatusBar';
import ControlPanel from '@/components/ControlPanel';
import NotationPanel from '@/components/NotationPanel';
import CapturedPieces from '@/components/CapturedPieces';
import RulesModal from '@/components/RulesModal';
import { useGameEngine } from '@/hooks/useGameEngine';

export default function Home() {
  const [rulesOpen, setRulesOpen] = useState(false);
  useGameEngine();

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden">
      {/* 标题 */}
      <header className="shrink-0 px-4 pt-5 text-center lg:pt-6">
        <h1 className="font-kai text-3xl tracking-[0.3em] text-gold-300 drop-shadow-[0_2px_8px_rgba(201,169,97,0.3)] lg:text-4xl xl:text-5xl">
          中國象棋
        </h1>
        <p className="mt-1 font-display text-xs tracking-[0.4em] text-paper-200/50 lg:text-sm">
          楚 河 漢 界 · 纵 横 十 九
        </p>
      </header>

      {/* 主体布局：xl 及以上三栏，以下堆叠 */}
      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col items-center gap-4 px-3 py-4 xl:flex-row xl:items-start xl:justify-center xl:gap-5">
        {/* 左栏：控制 + 阵亡 */}
        <aside className="order-2 flex w-full max-w-md flex-col gap-3 xl:order-1 xl:w-60 xl:shrink-0">
          <ControlPanel onOpenRules={() => setRulesOpen(true)} />
          <CapturedPieces />
        </aside>

        {/* 中栏：状态 + 棋盘 */}
        <section className="order-1 flex w-full flex-col items-center gap-3 xl:order-2 xl:min-w-0 xl:flex-1">
          <div className="w-full max-w-[640px]">
            <StatusBar />
          </div>
          <Board />
        </section>

        {/* 右栏：记谱 */}
        <aside className="order-3 flex w-full max-w-md flex-col gap-3 xl:w-72 xl:shrink-0">
          <NotationPanel />
        </aside>
      </main>

      <footer className="shrink-0 pb-4 text-center text-xs text-paper-200/30">
        严格遵循中国象棋竞赛规则 · 红先黑后
      </footer>

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}

import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { unlockAudio } from '@/lib/sound';

export function useGameEngine() {
  const mode = useGameStore((s) => s.mode);
  const turn = useGameStore((s) => s.turn);
  const playerColor = useGameStore((s) => s.playerColor);
  const status = useGameStore((s) => s.status);
  const aiThinking = useGameStore((s) => s.aiThinking);
  const requestAIMove = useGameStore((s) => s.requestAIMove);

  useEffect(() => {
    // pve：AI 颜色轮到时触发；aiva：任何一方轮到都触发
    const shouldTrigger =
      !aiThinking &&
      status !== 'redWin' &&
      status !== 'blackWin' &&
      ((mode === 'pve' && turn !== playerColor) || mode === 'aiva');
    if (shouldTrigger) {
      const timer = setTimeout(() => requestAIMove(), mode === 'aiva' ? 400 : 120);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [mode, turn, playerColor, aiThinking, status, requestAIMove]);

  useEffect(() => {
    const handler = () => unlockAudio();
    window.addEventListener('pointerdown', handler, { once: true });
    return () => window.removeEventListener('pointerdown', handler);
  }, []);
}

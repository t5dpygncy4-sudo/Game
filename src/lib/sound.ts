export type SoundType = 'select' | 'move' | 'capture' | 'check' | 'win' | 'lose' | 'illegal';

let ctx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  return ctx;
}

export function setMuted(value: boolean): void {
  muted = value;
}

export function isMuted(): boolean {
  return muted;
}

interface ToneOptions {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  sweep?: number;
}

function tone(opts: ToneOptions): void {
  const audio = getCtx();
  if (!audio || muted) return;
  const { freq, duration, type = 'sine', gain = 0.2, delay = 0, sweep } = opts;
  const start = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (sweep !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, sweep), start + duration);
  }
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(g);
  g.connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function noise(duration: number, gain: number, delay = 0): void {
  const audio = getCtx();
  if (!audio || muted) return;
  const start = audio.currentTime + delay;
  const bufferSize = Math.floor(audio.sampleRate * duration);
  const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const src = audio.createBufferSource();
  src.buffer = buffer;
  const g = audio.createGain();
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1800, start);
  src.connect(filter);
  filter.connect(g);
  g.connect(audio.destination);
  src.start(start);
  src.stop(start + duration);
}

export function playSound(type: SoundType): void {
  switch (type) {
    case 'select':
      tone({ freq: 880, duration: 0.06, type: 'triangle', gain: 0.12 });
      break;
    case 'move':
      tone({ freq: 320, duration: 0.09, type: 'sine', gain: 0.22, sweep: 180 });
      noise(0.05, 0.08);
      break;
    case 'capture':
      tone({ freq: 180, duration: 0.14, type: 'square', gain: 0.18, sweep: 80 });
      noise(0.12, 0.22);
      break;
    case 'check':
      tone({ freq: 660, duration: 0.12, type: 'sawtooth', gain: 0.16 });
      tone({ freq: 990, duration: 0.16, type: 'sawtooth', gain: 0.14, delay: 0.12 });
      break;
    case 'win':
      tone({ freq: 523, duration: 0.14, type: 'triangle', gain: 0.2 });
      tone({ freq: 659, duration: 0.14, type: 'triangle', gain: 0.2, delay: 0.14 });
      tone({ freq: 784, duration: 0.14, type: 'triangle', gain: 0.2, delay: 0.28 });
      tone({ freq: 1047, duration: 0.3, type: 'triangle', gain: 0.22, delay: 0.42 });
      break;
    case 'lose':
      tone({ freq: 392, duration: 0.18, type: 'sawtooth', gain: 0.16, sweep: 260 });
      tone({ freq: 294, duration: 0.28, type: 'sawtooth', gain: 0.16, sweep: 180, delay: 0.18 });
      tone({ freq: 196, duration: 0.4, type: 'sawtooth', gain: 0.16, sweep: 120, delay: 0.42 });
      break;
    case 'illegal':
      tone({ freq: 200, duration: 0.08, type: 'square', gain: 0.12 });
      tone({ freq: 150, duration: 0.1, type: 'square', gain: 0.12, delay: 0.08 });
      break;
    default:
      break;
  }
}

export function unlockAudio(): void {
  getCtx();
}

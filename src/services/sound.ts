// Synthesized sound effects, the same patches as the design canvas (C major pentatonic).
import { AudioContext } from 'react-native-audio-api';
import type { SoundName } from '../game/engine';

// tier 1 merges sound highest; each tier steps down the C D E G A pentatonic scale
const PITCH = [1046.5, 880, 784, 659.3, 587.3, 523.3, 440, 392, 329.6, 293.7, 261.6];

type Ctx = InstanceType<typeof AudioContext>;
let ac: Ctx | null = null;
let master: ReturnType<Ctx['createGain']> | null = null;
let noiseBuf: ReturnType<Ctx['createBuffer']> | null = null;
let landAt = 0;
let warned = false;

function fail(err: unknown) {
  if (warned) return;
  warned = true;
  console.warn('Sound effects disabled:', err instanceof Error ? err.message : String(err));
}

function context(): Ctx {
  if (!ac) {
    ac = new AudioContext();
    master = ac.createGain();
    master.gain.value = 0.5;
    master.connect(ac.destination);
    const len = Math.floor(ac.sampleRate * 0.6);
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  }
  return ac;
}

function tone(f0: number, f1: number, dur: number, type: 'sine' | 'triangle' | 'square' | 'sawtooth', vol: number, delay = 0) {
  const c = context();
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.7);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(master!);
  o.start(t);
  o.stop(t + dur + 0.03);
}

function noise(dur: number, vol: number, freq: number, q: number, delay = 0) {
  const c = context();
  const t = c.currentTime + delay;
  const src = c.createBufferSource();
  const f = c.createBiquadFilter();
  const g = c.createGain();
  src.buffer = noiseBuf;
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(master!);
  src.start(t);
  src.stop(t + dur + 0.03);
}

export function playSfx(name: SoundName, tier = 0, combo = 0, strength = 1): void {
  try {
    const c = context();
    if (c.state === 'suspended') c.resume();
    switch (name) {
      case 'drop':
        noise(0.16, 0.1, 1400, 0.8);
        tone(620, 340, 0.14, 'sine', 0.05);
        break;
      case 'land': {
        if (c.currentTime - landAt < 0.06) return;
        landAt = c.currentTime;
        tone(190 - tier * 9, 70, 0.12 + tier * 0.01, 'sine', 0.05 + 0.1 * strength);
        break;
      }
      case 'squish':
        noise(0.05, 0.05, 900, 1.6);
        break;
      case 'merge': {
        // +1 semitone per combo step, capped at +7
        const f = PITCH[Math.max(0, tier - 1)] * Math.pow(2, Math.min(7, Math.max(0, combo - 1)) / 12);
        tone(f * 0.72, f * 1.18, 0.24, 'sine', 0.22);
        tone(f * 2, f * 2.5, 0.1, 'triangle', 0.05, 0.012);
        noise(0.07, 0.07, 2200, 1.2);
        if (tier >= 9) tone(110, 42, 0.42, 'sine', 0.28);
        break;
      }
      case 'discover':
        [1046.5, 1318.5, 1568, 2093].forEach((f, i) => tone(f, f * 1.01, 0.32, 'triangle', 0.09, 0.05 + i * 0.075));
        noise(0.5, 0.03, 6000, 0.7);
        break;
      case 'over':
        tone(523, 196, 0.5, 'triangle', 0.12);
        tone(392, 147, 0.7, 'sawtooth', 0.035, 0.32);
        break;
      case 'shake':
        for (let i = 0; i < 5; i++) noise(0.07, 0.08, 900 + i * 260, 1.4, i * 0.085);
        break;
      case 'pop':
        tone(1400, 2100, 0.07, 'square', 0.035);
        noise(0.05, 0.08, 3000, 1.1);
        tone(1900, 2600, 0.09, 'sine', 0.04, 0.06);
        break;
      case 'beat':
        tone(70, 48, 0.16, 'sine', 0.2);
        tone(64, 44, 0.16, 'sine', 0.15, 0.2);
        break;
    }
  } catch (err) {
    // audio unavailable (no output device, interrupted session): stay silent, say so once
    fail(err);
  }
}

export function playTap(): void {
  try {
    tone(880, 1180, 0.06, 'sine', 0.06);
  } catch (err) {
    fail(err);
  }
}

// Results jingle: a bright marimba arpeggio up the C major chord, one more note for a new best.
export function playJingle(newBest: boolean): void {
  try {
    const notes = newBest ? [523.3, 659.3, 784, 1046.5, 1318.5] : [523.3, 659.3, 784, 1046.5];
    notes.forEach((f, i) => {
      tone(f, f, 0.34, 'sine', 0.14, i * 0.085);
      tone(f * 4, f * 4, 0.07, 'sine', 0.025, i * 0.085);
    });
    tone(2093, 2100, 0.55, 'triangle', 0.035, notes.length * 0.085);
    noise(0.4, 0.02, 7000, 0.8, notes.length * 0.085);
  } catch (err) {
    fail(err);
  }
}

// Count-up tick: a tiny wooden click.
export function playTick(): void {
  try {
    noise(0.025, 0.045, 3200, 3);
    tone(1800, 1500, 0.03, 'sine', 0.02);
  } catch (err) {
    fail(err);
  }
}

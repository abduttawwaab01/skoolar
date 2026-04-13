'use client';

/**
 * Skoolar UI Sound System
 * Uses the Web Audio API to generate soft, engaging sounds.
 * No external audio files needed — all sounds are synthesized.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume: number = 0.08,
  attack: number = 0.01,
  decay: number = 0.1,
  sustain: number = 0.06,
  release: number = 0.15
) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + attack);
    gain.gain.linearRampToValueAtTime(sustain, ctx.currentTime + attack + decay);
    gain.gain.setValueAtTime(sustain, ctx.currentTime + duration - release);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not available - fail silently
  }
}

function playChord(frequencies: number[], duration: number, type: OscillatorType = 'sine', volume: number = 0.05) {
  frequencies.forEach((freq, i) => {
    setTimeout(() => playTone(freq, duration, type, volume), i * 30);
  });
}

function playSequence(notes: { freq: number; delay: number }[], type: OscillatorType = 'sine', volume: number = 0.06, noteDuration: number = 0.15) {
  notes.forEach(({ freq, delay }) => {
    setTimeout(() => playTone(freq, noteDuration, type, volume), delay);
  });
}

export function playClick() {
  playTone(800, 0.08, 'sine', 0.04, 0.005, 0.03, 0.02, 0.04);
}

export function playNavigate() {
  playSequence([
    { freq: 523.25, delay: 0 },
    { freq: 659.25, delay: 50 },
  ], 'sine', 0.04, 0.12);
}

export function playSuccess() {
  playSequence([
    { freq: 523.25, delay: 0 },
    { freq: 659.25, delay: 80 },
    { freq: 783.99, delay: 160 },
    { freq: 1046.50, delay: 240 },
  ], 'sine', 0.05, 0.2);
}

export function playError() {
  playSequence([
    { freq: 200, delay: 0 },
    { freq: 180, delay: 100 },
  ], 'triangle', 0.04, 0.2);
}

export function playNotification() {
  playSequence([
    { freq: 880, delay: 0 },
    { freq: 1108.73, delay: 120 },
  ], 'sine', 0.04, 0.25);
}

export function playWarning() {
  playSequence([
    { freq: 440, delay: 0 },
    { freq: 440, delay: 150 },
  ], 'triangle', 0.04, 0.12);
}

export function playDelete() {
  playSequence([
    { freq: 600, delay: 0 },
    { freq: 450, delay: 60 },
    { freq: 300, delay: 120 },
  ], 'sine', 0.03, 0.15);
}

export function playSave() {
  playSequence([
    { freq: 440, delay: 0 },
    { freq: 554.37, delay: 70 },
    { freq: 659.25, delay: 140 },
  ], 'sine', 0.04, 0.18);
}

export function playMessage() {
  playSequence([
    { freq: 698.46, delay: 0 },
    { freq: 880, delay: 100 },
  ], 'sine', 0.04, 0.15);
}

export function playAchievement() {
  playSequence([
    { freq: 523.25, delay: 0 },
    { freq: 659.25, delay: 80 },
    { freq: 783.99, delay: 160 },
    { freq: 1046.50, delay: 240 },
    { freq: 1318.51, delay: 350 },
  ], 'sine', 0.04, 0.25);
}

export function playRefresh() {
  playTone(700, 0.15, 'sine', 0.03, 0.01, 0.05, 0.02, 0.08);
  setTimeout(() => playTone(900, 0.1, 'sine', 0.03, 0.01, 0.03, 0.02, 0.05), 100);
}

export function playLogin() {
  playChord([523.25, 659.25, 783.99], 0.4, 'sine', 0.03);
}

export function playLogout() {
  playSequence([
    { freq: 783.99, delay: 0 },
    { freq: 659.25, delay: 80 },
    { freq: 523.25, delay: 160 },
  ], 'sine', 0.03, 0.2);
}

export function playModalOpen() {
  playTone(400, 0.12, 'sine', 0.025, 0.01, 0.04, 0.015, 0.06);
}

export function playModalClose() {
  playTone(500, 0.1, 'sine', 0.02, 0.005, 0.03, 0.01, 0.05);
}

export function playToggleOn() {
  playSequence([{ freq: 500, delay: 0 }, { freq: 700, delay: 40 }], 'sine', 0.03, 0.1);
}

export function playToggleOff() {
  playSequence([{ freq: 600, delay: 0 }, { freq: 400, delay: 40 }], 'sine', 0.03, 0.1);
}

export function playSearch() {
  playTone(650, 0.08, 'sine', 0.02, 0.005, 0.02, 0.01, 0.04);
}

export function initAudioOnInteraction() {
  if (typeof window !== 'undefined') {
    const handler = () => {
      getAudioContext();
      document.removeEventListener('click', handler);
      document.removeEventListener('keydown', handler);
      document.removeEventListener('touchstart', handler);
    };
    document.addEventListener('click', handler);
    document.addEventListener('keydown', handler);
    document.addEventListener('touchstart', handler);
  }
}

export function areSoundsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('skoolar-sounds-enabled') !== 'false';
}

export function toggleSounds(): boolean {
  const enabled = !areSoundsEnabled();
  if (typeof window !== 'undefined') {
    localStorage.setItem('skoolar-sounds-enabled', String(enabled));
  }
  return enabled;
}

function conditionalPlay(fn: () => void) {
  if (areSoundsEnabled()) fn();
}

export const soundEffects = {
  click: () => conditionalPlay(playClick),
  navigate: () => conditionalPlay(playNavigate),
  success: () => conditionalPlay(playSuccess),
  error: () => conditionalPlay(playError),
  notification: () => conditionalPlay(playNotification),
  warning: () => conditionalPlay(playWarning),
  delete: () => conditionalPlay(playDelete),
  save: () => conditionalPlay(playSave),
  message: () => conditionalPlay(playMessage),
  achievement: () => conditionalPlay(playAchievement),
  refresh: () => conditionalPlay(playRefresh),
  login: () => conditionalPlay(playLogin),
  logout: () => conditionalPlay(playLogout),
  modalOpen: () => conditionalPlay(playModalOpen),
  modalClose: () => conditionalPlay(playModalClose),
  toggleOn: () => conditionalPlay(playToggleOn),
  toggleOff: () => conditionalPlay(playToggleOff),
  search: () => conditionalPlay(playSearch),
};

export default soundEffects;

/**
 * Veron Cyber Audio Synthesizer
 * 
 * Generates lightweight, signature Cybran-style synthesized harmonic chimes
 * using the browser's native Web Audio API. Zero external audio file downloads.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

export function isSoundEnabled(): boolean {
  try {
    const val = localStorage.getItem('veron_sound_enabled');
    return val !== null ? val === 'true' : true;
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem('veron_sound_enabled', enabled ? 'true' : 'false');
  } catch {}
}

export function getSoundVolume(): number {
  try {
    const val = localStorage.getItem('veron_sound_volume');
    if (val !== null) {
      const parsed = parseFloat(val);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) return parsed;
    }
    return 0.6; // Default pleasant volume
  } catch {
    return 0.6;
  }
}

export function setSoundVolume(volume: number): void {
  try {
    const clamped = Math.max(0, Math.min(1, volume));
    localStorage.setItem('veron_sound_volume', clamped.toString());
  } catch {}
}

/**
 * Plays the signature Veron completion chime.
 * High-tech dual-frequency harmonic tone with warm low-pass filter
 * and exponential decay envelope.
 */
export function playVeronChime(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const masterVolume = getSoundVolume();
  if (masterVolume <= 0.01) return;

  // Master Gain with click-free ramp
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.0001, now);
  masterGain.gain.linearRampToValueAtTime(masterVolume * 0.45, now + 0.015);
  masterGain.gain.exponentialRampToValueAtTime(masterVolume * 0.18, now + 0.09);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

  // Warm low-pass filter to eliminate harsh digital transients
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(3200, now);
  filter.Q.setValueAtTime(1.2, now);

  // Primary Oscillator: Cyber Amber Tone (D5 587Hz transitioning to A5 880Hz)
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(587.33, now);
  osc1.frequency.exponentialRampToValueAtTime(880.0, now + 0.065);

  // Secondary Harmonic: Triangle overtone for depth and body (D6 1174Hz)
  const osc2 = ctx.createOscillator();
  const osc2Gain = ctx.createGain();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(880.0, now);
  osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.08);
  osc2Gain.gain.setValueAtTime(0.28, now);

  // Connect routing graph:
  // osc1 -> filter
  // osc2 -> osc2Gain -> filter
  // filter -> masterGain -> destination
  osc1.connect(filter);
  osc2.connect(osc2Gain);
  osc2Gain.connect(filter);
  filter.connect(masterGain);
  masterGain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.45);
  osc2.stop(now + 0.45);
}

/**
 * Triggers test playback of the completion chime for settings preview.
 */
export function testVeronChime(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().then(() => playVeronChime());
  } else {
    playVeronChime();
  }
}

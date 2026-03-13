/**
 * Auditory feedback — simple Web Audio API tones.
 * No files to load, works instantly, very lightweight.
 * Controlled by the "sound_enabled" setting (default: on).
 */

import { getSetting, setSetting } from "./tauri";

let enabled: boolean | null = null;
let audioCtx: AudioContext | null = null;

/** Load the preference once, cache it. */
export async function initSound() {
  const val = await getSetting("sound_enabled");
  enabled = val !== "false"; // default on
}

export function isSoundEnabled() {
  return enabled !== false;
}

export async function toggleSound(): Promise<boolean> {
  const next = !isSoundEnabled();
  enabled = next;
  await setSetting("sound_enabled", next ? "true" : "false");
  if (next) playSuccess(); // preview
  return next;
}

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

/** Short, warm major-third chime — "success" */
export function playSuccess() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;

    // Two-note ascending chime (C5 → E5), warm sine wave
    const freqs = [523, 659];
    for (let i = 0; i < freqs.length; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freqs[i];
      gain.gain.setValueAtTime(0, now + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.15, now + i * 0.1 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.35);
    }
  } catch {
    // Audio not available — silently ignore
  }
}

/** Single low tone — "undo" */
export function playUndo() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 330; // E4 — gentle descending feel
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  } catch {
    // silently ignore
  }
}

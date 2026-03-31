/**
 * NotificationSound — Web Audio API notification (WhatsApp style)
 * Debounced: max 1 sound per 2000ms
 */

export const MUTE_KEY = "entur_inbox_muted";
const SOUND_DEBOUNCE_MS = 2000;

let audioCtx: AudioContext | null = null;
let lastPlayedAt = 0;

export function playNotification(): void {
  const now = Date.now();
  if (now - lastPlayedAt < SOUND_DEBOUNCE_MS) return;
  lastPlayedAt = now;

  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const ctx = audioCtx;
    const t = ctx.currentTime;

    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, t);
    osc1.connect(gain);
    osc1.start(t);
    osc1.stop(t + 0.12);

    const gain2 = ctx.createGain();
    gain2.connect(ctx.destination);
    gain2.gain.setValueAtTime(0.12, t + 0.13);
    gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(660, t + 0.13);
    osc2.connect(gain2);
    osc2.start(t + 0.13);
    osc2.stop(t + 0.3);
  } catch {
    /* Audio not supported */
  }
}

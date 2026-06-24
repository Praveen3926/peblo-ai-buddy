let audioCtx: AudioContext | null = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Play a cheerful, sparkling chiming sequence for starting narration or generating a story
 */
export function playChime(isMuted: boolean) {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Play a gentle rising cute chime (C5 to E5 to G5 to C6)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + index * 0.08);
      
      gain.gain.setValueAtTime(0, now + index * 0.08);
      gain.gain.linearRampToValueAtTime(0.15, now + index * 0.08 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.35);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now + index * 0.08);
      osc.stop(now + index * 0.08 + 0.4);
    });
  } catch (e) {
    console.error("Failed to play start chime:", e);
  }
}

/**
 * Play an enthusiastic "Success" ding-ding major chord sound for correct answers
 */
export function playSuccess(isMuted: boolean) {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Happy, bright major arpeggio: G5 -> C6 -> E6
    const notes = [783.99, 1046.50, 1318.51];
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "triangle"; // Softer and more whimsical than sine or square
      osc.frequency.setValueAtTime(freq, now + index * 0.06);
      
      gain.gain.setValueAtTime(0, now + index * 0.06);
      gain.gain.linearRampToValueAtTime(0.18, now + index * 0.06 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.06 + 0.3);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now + index * 0.06);
      osc.stop(now + index * 0.06 + 0.35);
    });
  } catch (e) {
    console.error("Failed to play success sound:", e);
  }
}

/**
 * Play a cute, soft, non-punishing descending sound for incorrect attempts to keep children encouraged
 */
export function playFailure(isMuted: boolean) {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Soft, cute descending mellow slide: G4 -> E4
    const notes = [392.00, 329.63];
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + index * 0.12);
      
      gain.gain.setValueAtTime(0, now + index * 0.12);
      gain.gain.linearRampToValueAtTime(0.15, now + index * 0.12 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.12 + 0.4);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now + index * 0.12);
      osc.stop(now + index * 0.12 + 0.45);
    });
  } catch (e) {
    console.error("Failed to play failure sound:", e);
  }
}

/**
 * Play a shimmering magic spell sound when badged achievements are unlocked
 */
export function playSparkle(isMuted: boolean) {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Quick cascading high notes for sticker sparkliness
    const notes = [987.77, 1174.66, 1396.91, 1567.98, 1975.53, 2349.32]; // B5, D6, F6, G6, B6, D7
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + index * 0.04);
      
      gain.gain.setValueAtTime(0, now + index * 0.04);
      gain.gain.linearRampToValueAtTime(0.08, now + index * 0.04 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.04 + 0.2);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now + index * 0.04);
      osc.stop(now + index * 0.04 + 0.25);
    });
  } catch (e) {
    console.error("Failed to play sparkle sound:", e);
  }
}

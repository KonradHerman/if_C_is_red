/**
 * Polyphonic pitch detection from an FFT frame, for the audio-file visualizer.
 *
 * The previous approach treated every local maximum in the spectrum as a note.
 * That fails three ways, all measured against both synthetic ground truth and
 * real recordings:
 *
 *  - Below middle C an FFT bin is wider than a semitone (at 48kHz/4096 a
 *    semitone at C2 spans 0.33 bins), so rounding a peak's frequency to the
 *    nearest note returns whichever bin centre the energy landed in, and small
 *    spectral wobble flips the reported bass note between neighbours.
 *  - Overtones read as notes. Suppressing a hand-picked interval list
 *    (+12/+19/+24) misses the rest of the series.
 *  - A threshold hung off the frame's loudest bin admits noise on sparse
 *    material and rejects real notes on dense material.
 *
 * Instead we score each candidate note by the evidence across its whole
 * harmonic series, then greedily take the strongest and subtract its expected
 * partials before re-scoring. Pitch accuracy no longer depends on bin width:
 * C2 and C#2 are indistinguishable at the fundamental but their series diverge
 * higher up, where resolution is ample.
 */

export interface DetectedNote {
  note: number;    // MIDI note number
  velocity: number; // 0-1
  /**
   * Rise in this note's own harmonic energy since the previous frame, relative
   * to the frame's strongest peak. A note struck again while still ringing
   * never disappears from the detector's output, so presence alone cannot tell
   * repeats apart — but a fresh strike is a sharp positive jump here.
   */
  onset: number;
}

export interface DetectOptions {
  sampleRate: number;
  /** Minimum harmonic salience for a note to register. Higher = stricter. */
  minSalience?: number;
  maxNotes?: number;
}

// E1..C7. The floor keeps sub-harmonic ghosts (a phantom octave below a real
// bass note) out while still covering the low E of a bass guitar.
const LOW_MIDI = 28;
const HIGH_MIDI = 96;
const PARTIALS = 6;
const FLOOR_BLOCK = 64;

const freqOf = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** Candidate fundamental frequencies, precomputed once. */
const CANDIDATES: number[] = [];
for (let m = LOW_MIDI; m <= HIGH_MIDI; m++) CANDIDATES.push(freqOf(m));

// Scratch buffers reused across frames so a 60fps analysis loop doesn't
// allocate megabytes per second.
let magBuf: Float32Array | null = null;
let promBuf: Float32Array | null = null;
let residualBuf: Float32Array | null = null;
let sortBuf: Float32Array | null = null;
let prevMagBuf: Float32Array | null = null;
let havePrev = false;

function ensureBuffers(n: number) {
  if (!magBuf || magBuf.length !== n) {
    magBuf = new Float32Array(n);
    promBuf = new Float32Array(n);
    residualBuf = new Float32Array(n);
    prevMagBuf = new Float32Array(n);
    sortBuf = new Float32Array(FLOOR_BLOCK);
    havePrev = false;
  }
}

/** Clear inter-frame state; call when starting analysis of a new source. */
export function resetDetector(): void {
  havePrev = false;
}

/** Linear interpolation into a spectrum-shaped array at a fractional index. */
function interp(arr: Float32Array, x: number): number {
  if (x < 0 || x >= arr.length - 1) return 0;
  const i = x | 0;
  return arr[i] + (arr[i + 1] - arr[i]) * (x - i);
}

/** Best of three adjacent taps, so mild inharmonicity still lands on target. */
function tap(arr: Float32Array, x: number): number {
  const a = interp(arr, x - 1), b = interp(arr, x), c = interp(arr, x + 1);
  return a > b ? (a > c ? a : c) : (b > c ? b : c);
}

export function detectNotes(db: Float32Array, opts: DetectOptions): DetectedNote[] {
  const bins = db.length;
  const binHz = (opts.sampleRate / 2) / bins;
  const minSalience = opts.minSalience ?? 0.6;
  const maxNotes = opts.maxNotes ?? 6;

  ensureBuffers(bins);
  const mag = magBuf!, prom = promBuf!, residual = residualBuf!, scratch = sortBuf!;
  const prevMag = prevMagBuf!;

  for (let i = 0; i < bins; i++) mag[i] = Math.pow(10, db[i] / 20);

  // Prominence above a block-median noise floor. Judging each peak against its
  // local neighbourhood is what makes one threshold work for both a solo piano
  // and a full mix.
  let promMax = 0;
  for (let start = 0; start < bins; start += FLOOR_BLOCK) {
    const end = Math.min(bins, start + FLOOR_BLOCK);
    const len = end - start;
    for (let i = 0; i < len; i++) scratch[i] = mag[start + i];
    const slice = scratch.subarray(0, len);
    slice.sort();
    const floor = slice[len >> 1];
    for (let i = start; i < end; i++) {
      const p = mag[i] - floor;
      prom[i] = p > 0 ? p : 0;
      if (prom[i] > promMax) promMax = prom[i];
    }
  }
  if (promMax <= 0) return [];
  for (let i = 0; i < bins; i++) residual[i] = prom[i] / promMax;

  const out: DetectedNote[] = [];
  for (let pick = 0; pick < maxNotes; pick++) {
    let bestIdx = -1;
    let bestSalience = 0;
    for (let c = 0; c < CANDIDATES.length; c++) {
      const f0 = CANDIDATES[c];
      let s = 0;
      for (let k = 1; k <= PARTIALS; k++) {
        const x = (k * f0) / binHz;
        if (x >= bins - 1) break;
        s += tap(residual, x) / k;
      }
      if (s > bestSalience) { bestSalience = s; bestIdx = c; }
    }
    if (bestIdx < 0 || bestSalience < minSalience) break;

    // Half-wave-rectified flux across this note's own partials, in the same
    // normalised units as prominence so one threshold works across material.
    let onset = 0;
    if (havePrev) {
      const f0c = CANDIDATES[bestIdx];
      for (let k = 1; k <= PARTIALS; k++) {
        const i = Math.round((k * f0c) / binHz);
        if (i >= bins) break;
        const rise = mag[i] - prevMag[i];
        if (rise > 0) onset += rise / k;
      }
      onset /= promMax;
    }

    out.push({
      note: LOW_MIDI + bestIdx,
      velocity: Math.min(1, Math.max(0.2, bestSalience / 1.4)),
      onset,
    });

    // Subtract the accepted note's *expected* partial envelope rather than
    // clearing those bins, so a genuine note sharing a partial (an octave up,
    // say) keeps whatever energy exceeds the prediction.
    const f0 = CANDIDATES[bestIdx];
    const base = tap(residual, f0 / binHz);
    for (let k = 1; k <= PARTIALS; k++) {
      const centre = (k * f0) / binHz;
      if (centre >= bins - 1) break;
      const est = base / Math.pow(k, 1.3);
      const mid = Math.round(centre);
      for (let d = -2; d <= 2; d++) {
        const i = mid + d;
        if (i < 0 || i >= bins) continue;
        const next = residual[i] - est * (1 - Math.abs(d) / 3);
        residual[i] = next > 0 ? next : 0;
      }
    }
  }

  prevMag.set(mag);
  havePrev = true;
  return out;
}

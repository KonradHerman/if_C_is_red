import { NOTE_NAMES, pitchClass } from './noteGeometry';

/**
 * Minimal chord recognizer. Given a set of active MIDI note numbers, returns
 * a best-effort chord name (e.g. "Cmaj7") or `null` if nothing musical fits.
 *
 * Approach: try every pitch class as root, match against a library of
 * pitch-class-interval sets, pick the match with best coverage score.
 */

interface ChordShape {
  name: string;      // suffix after root (e.g. "m7")
  intervals: number[]; // in semitones from root, not including 0
}

// Ordered loosely by specificity (more intervals first so 7ths beat triads).
const SHAPES: ChordShape[] = [
  { name: 'maj7', intervals: [4, 7, 11] },
  { name: 'm7',   intervals: [3, 7, 10] },
  { name: '7',    intervals: [4, 7, 10] },
  { name: 'mMaj7', intervals: [3, 7, 11] },
  { name: 'dim7', intervals: [3, 6, 9] },
  { name: 'm7b5', intervals: [3, 6, 10] },
  { name: 'add9', intervals: [4, 7, 2] },
  { name: 'sus4', intervals: [5, 7] },
  { name: 'sus2', intervals: [2, 7] },
  { name: 'aug',  intervals: [4, 8] },
  { name: 'dim',  intervals: [3, 6] },
  { name: '',     intervals: [4, 7] },   // major
  { name: 'm',    intervals: [3, 7] },   // minor
  { name: '5',    intervals: [7] },      // power chord
];

export interface ChordResult {
  label: string;    // e.g. "Cmaj7"
  root: number;     // pitch class
  quality: string;  // e.g. "maj7"
  bass?: number;    // MIDI note of the lowest sounding note
}

export function detectChord(noteNumbers: number[]): ChordResult | null {
  if (noteNumbers.length === 0) return null;
  if (noteNumbers.length === 1) {
    return { label: NOTE_NAMES[pitchClass(noteNumbers[0])], root: pitchClass(noteNumbers[0]), quality: '' };
  }

  const pcSet = new Set(noteNumbers.map(pitchClass));
  const pcs = [...pcSet];

  let best: { score: number; root: number; shape: ChordShape } | null = null;

  for (const root of pcs) {
    for (const shape of SHAPES) {
      const needed = shape.intervals.map((i) => (root + i) % 12);
      const allPresent = needed.every((pc) => pcSet.has(pc));
      if (!allPresent) continue;

      // Score = chord tones matched, minus penalty for extra non-chord tones.
      const chordTones = new Set<number>([root, ...needed]);
      let matched = chordTones.size; // all chord tones present
      let extras = 0;
      pcSet.forEach((pc) => { if (!chordTones.has(pc)) extras++; });
      const score = matched - extras * 0.25;

      if (!best || score > best.score) {
        best = { score, root, shape };
      }
    }
  }

  if (!best) return null;

  const label = NOTE_NAMES[best.root] + best.shape.name;
  const lowest = Math.min(...noteNumbers);
  const bassPc = pitchClass(lowest);
  const result: ChordResult = { label, root: best.root, quality: best.shape.name };
  if (bassPc !== best.root) {
    result.label = `${label}/${NOTE_NAMES[bassPc]}`;
    result.bass = lowest;
  }
  return result;
}

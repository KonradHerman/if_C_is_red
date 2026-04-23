import type { Sequence } from './sequencer';

/**
 * Hand-authored demo pieces so first-time visitors immediately hear & see the idea.
 * Each event carries a time in ms. Velocity is 0-1.
 */

function build(
  notes: { note: number; start: number; duration: number; velocity?: number }[],
): Sequence {
  const events = notes.flatMap((n) => [
    { t: n.start, type: 'on'  as const, note: n.note, velocity: n.velocity ?? 0.7 },
    { t: n.start + n.duration, type: 'off' as const, note: n.note, velocity: n.velocity ?? 0.7 },
  ]);
  events.sort((a, b) => a.t - b.t);
  const duration = Math.max(...events.map((e) => e.t)) + 300;
  return { events, duration };
}

// Pachelbel's Canon in D — opening bars, slow and declarative.
const canonInD = build([
  { note: 62, start:    0, duration: 1200 },
  { note: 69, start: 1200, duration: 1200 },
  { note: 66, start: 2400, duration: 1200 },
  { note: 62, start: 3600, duration: 1200 },
  { note: 64, start: 4800, duration: 1200 },
  { note: 59, start: 6000, duration: 1200 },
  { note: 62, start: 7200, duration: 1200 },
  { note: 57, start: 8400, duration: 1200 },
  // Overlay melodic 8th notes
  { note: 74, start: 4800, duration:  600, velocity: 0.8 },
  { note: 73, start: 5400, duration:  600, velocity: 0.7 },
  { note: 74, start: 6000, duration:  600, velocity: 0.8 },
  { note: 69, start: 6600, duration:  600, velocity: 0.7 },
  { note: 71, start: 7200, duration:  600, velocity: 0.8 },
  { note: 69, start: 7800, duration:  600, velocity: 0.7 },
  { note: 66, start: 8400, duration:  600, velocity: 0.7 },
  { note: 69, start: 9000, duration:  600, velocity: 0.7 },
]);

// Gymnopédie No.1 — Satie. Simple triads over a walking bass.
const gymnopedie = build([
  // Left hand bass
  { note: 50, start:    0, duration: 1800 },
  { note: 57, start: 1800, duration: 1800 },
  { note: 61, start: 3600, duration: 1800 },
  { note: 55, start: 5400, duration: 1800 },
  { note: 52, start: 7200, duration: 1800 },
  // Right hand chord stabs
  { note: 69, start:  900, duration:  900 },
  { note: 73, start:  900, duration:  900 },
  { note: 76, start:  900, duration:  900 },
  { note: 71, start: 2700, duration:  900 },
  { note: 74, start: 2700, duration:  900 },
  { note: 78, start: 2700, duration:  900 },
  { note: 69, start: 4500, duration:  900 },
  { note: 73, start: 4500, duration:  900 },
  { note: 76, start: 4500, duration:  900 },
  { note: 71, start: 6300, duration:  900 },
  { note: 74, start: 6300, duration:  900 },
  { note: 78, start: 6300, duration:  900 },
]);

// A chromatic arpeggio — shows off the full color rainbow.
const chromatic = build(
  Array.from({ length: 24 }, (_, i) => ({
    note: 60 + i,
    start: i * 200,
    duration: 260,
    velocity: 0.6 + (i % 4) * 0.1,
  })),
);

// "Mystic" — repeated Scriabin-esque dominant stack.
const mysticChord = build([
  { note: 60, start:    0, duration: 3000 },
  { note: 66, start:  200, duration: 2800 },
  { note: 70, start:  400, duration: 2600 },
  { note: 74, start:  600, duration: 2400 },
  { note: 79, start:  800, duration: 2200 },
  { note: 83, start: 1000, duration: 2000 },
]);

export interface DemoSong {
  id: string;
  title: string;
  composer: string;
  sequence: Sequence;
}

export const demoSongs: DemoSong[] = [
  { id: 'canon',      title: 'Canon in D (excerpt)', composer: 'Pachelbel',  sequence: canonInD  },
  { id: 'gymnopedie', title: 'Gymnopédie No.1',      composer: 'Satie',      sequence: gymnopedie },
  { id: 'chromatic',  title: 'Chromatic Rainbow',    composer: '—',          sequence: chromatic },
  { id: 'mystic',     title: 'Mystic Chord',         composer: 'Scriabin',   sequence: mysticChord },
];

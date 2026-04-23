/**
 * Shared note-to-coordinate helpers used across visualizers.
 * Previously duplicated in Ball/Bars/Particle visualizers.
 */

export const MIDI_A0 = 21;   // lowest piano key
export const MIDI_C8 = 108;  // highest piano key
export const MIDI_MIDDLE_C = 60;

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export function pitchClass(noteNumber: number): number {
  return ((noteNumber % 12) + 12) % 12;
}

export function octave(noteNumber: number): number {
  return Math.floor(noteNumber / 12) - 1;
}

export function noteLabel(noteNumber: number): string {
  return `${NOTE_NAMES[pitchClass(noteNumber)]}${octave(noteNumber)}`;
}

export interface GeometryConfig {
  viewBoxWidth: number;
  viewBoxHeight: number;
  middleOctave?: number;
  octaveCount?: number;
}

export function noteXPosition(noteNumber: number, cfg: GeometryConfig): number {
  const noteInOctave = pitchClass(noteNumber);
  const spreadFactor = cfg.viewBoxWidth / 14;
  return cfg.viewBoxWidth / 2 + (noteInOctave - 5.5) * spreadFactor;
}

export function noteYPosition(noteNumber: number, cfg: GeometryConfig): number {
  const octaveCount = cfg.octaveCount ?? 9;
  const middleOctave = cfg.middleOctave ?? 5;
  const octaveHeight = cfg.viewBoxHeight / octaveCount;
  const oct = octave(noteNumber);
  const octaveDiff = oct - middleOctave;
  const middleY = cfg.viewBoxHeight / 2;
  return middleY - octaveDiff * octaveHeight;
}

/** Map noteNumber to a 0-1 vertical coordinate for piano-roll style visualizers. */
export function pianoRollY(noteNumber: number, lowNote = MIDI_A0, highNote = MIDI_C8): number {
  const range = highNote - lowNote;
  const clamped = Math.max(lowNote, Math.min(highNote, noteNumber));
  return 1 - (clamped - lowNote) / range;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

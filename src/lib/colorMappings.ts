import { derived } from 'svelte/store';
import { persisted } from './persist';

/**
 * Chromesthesia color-mapping presets.
 * Indices are pitch classes: 0=C, 1=C#, ... 11=B.
 */

export interface ColorMapping {
  id: string;
  name: string;
  description: string;
  colors: string[]; // length 12
}

export const COLOR_MAPPINGS: ColorMapping[] = [
  {
    id: 'if-c-is-red',
    name: 'If C Is Red',
    description: 'The original palette — a vivid chromatic rainbow pinned at C.',
    colors: [
      '#d02f33', '#bd00f5', '#a242ff', '#657aff',
      '#2e91fb', '#00b9b9', '#00cf65', '#00de00',
      '#bed100', '#fab900', '#ffad37', '#f3ad80',
    ],
  },
  {
    id: 'scriabin',
    name: 'Scriabin',
    description: "Alexander Scriabin's mystical synesthetic mapping (1911).",
    colors: [
      '#ff0000', // C  red
      '#ce0071', // C# violet-purple
      '#ffff00', // D  yellow
      '#8e8e8e', // D# steel / flesh
      '#7fd4f2', // E  sky blue
      '#a31f1f', // F  dark red
      '#0057ff', // F# bright blue
      '#ff80b0', // G  rose
      '#a34cff', // G# purple
      '#4aa846', // A  green
      '#8e8e8e', // A# steel (paired w/ D#)
      '#6ec2e8', // B  pale blue
    ],
  },
  {
    id: 'newton',
    name: 'Newton',
    description: "Isaac Newton's prism mapping of the 7 diatonic tones (1704).",
    colors: [
      '#d42020', // C  red
      '#ec5a20', // C# (interpolated)
      '#ff9500', // D  orange
      '#ffe000', // D# (interpolated between orange/yellow)
      '#fff700', // E  yellow
      '#4dd04d', // F  green
      '#2ab0b0', // F# (interpolated)
      '#3b7bff', // G  blue
      '#2b4ec9', // G# (interpolated)
      '#5b2ac2', // A  indigo
      '#8a3bd1', // A# (interpolated)
      '#c540ff', // B  violet
    ],
  },
  {
    id: 'rimington',
    name: 'Rimington',
    description: "Alexander Wallace Rimington's colour-organ mapping (1895).",
    colors: [
      '#bf0a0a', // C  deep red
      '#d43a13', // C# crimson
      '#ff6b00', // D  orange
      '#ffb400', // D# amber
      '#ffe500', // E  yellow
      '#b5d400', // F  yellow-green
      '#36bf36', // F# green
      '#00b5b5', // G  cyan-green
      '#0080ff', // G# blue
      '#4030d4', // A  indigo
      '#7a2cc4', // A# violet-indigo
      '#c014a7', // B  violet
    ],
  },
];

const DEFAULT_ID = 'if-c-is-red';

export const selectedColorMappingId = persisted<string>('colorMappingId', DEFAULT_ID);
export const customColors = persisted<string[]>(
  'customColors',
  [...COLOR_MAPPINGS[0].colors],
);

export const activeColorMap = derived(
  [selectedColorMappingId, customColors],
  ([$id, $custom]) => {
    if ($id === 'custom') return $custom;
    const preset = COLOR_MAPPINGS.find((m) => m.id === $id);
    return preset ? preset.colors : COLOR_MAPPINGS[0].colors;
  },
);

/** Synchronous helper for code that can't use stores (e.g. canvas render loops). */
let currentColors: string[] = [...COLOR_MAPPINGS[0].colors];
activeColorMap.subscribe((c) => { currentColors = c; });

export function colorFor(noteNumber: number): string {
  const pc = ((noteNumber % 12) + 12) % 12;
  return currentColors[pc] || '#888';
}

// ============================================================
// Octave tint
// ============================================================
//
// The palette is the "base scale" at octave 4 (MIDI 60-71, the octave of
// middle C). Octaves below darken toward black; octaves above wash toward
// white and lose saturation.
//
// Fit against the reference render, whose measured per-octave means are
// L = 0.15 / 0.29 / 0.53 / 0.80 / 0.83 and S = 0.95 / 0.67 / 0.96 / 0.76 / 0.43.
// Downward is a clean geometric ramp (L × 0.53 per octave reproduces 0.29
// and 0.15). Upward is NOT geometric — the first octave jumps most of the
// way to white and later ones barely move — so those are table-driven.

const BASE_OCTAVE = 4;

/**
 * Remaining-headroom-to-white multiplier, indexed by octaves above base.
 *
 * Pitch is tied to lightness, so this has to keep falling across the whole
 * playable range — every octave up must read as visibly lighter than the last.
 * Fitting the reference image directly gave [1, .43, .36, .32, .30], which
 * plateaus after one octave: the top three octaves landed at the same
 * lightness and separated only by losing saturation, which reads as muddy tan
 * rather than pastel. The image only spanned five octaves, so its own plateau
 * was never meant to carry the top of a piano.
 */
const UP_LIGHTNESS = [1, 0.55, 0.35, 0.22, 0.15];
/**
 * Saturation multiplier, indexed by octaves above base. A pastel is light AND
 * still coloured; draining saturation is what turns a light warm hue into tan,
 * so high notes keep well over half their colour.
 */
const UP_SATURATION = [1, 0.88, 0.76, 0.66, 0.58];
/**
 * Saturation multiplier, indexed by octaves BELOW base. Not monotonic on
 * purpose: the octave just under the base scale is the reference's muted
 * transition band (slate blues, gray-greens, olives), while lower octaves
 * are dark enough that the reference keeps their hues near-pure.
 */
const DOWN_SATURATION = [1, 0.55, 0.90, 1, 1];

function ramp(table: number[], d: number): number {
  return table[Math.min(d, table.length - 1)];
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return { h: 0, s: 0, l: 0.5 };
  const v = parseInt(m[1], 16);
  const r = ((v >> 16) & 255) / 255;
  const g = ((v >> 8) & 255) / 255;
  const b = (v & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r)      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else                h = ((r - g) / d + 4) / 6;
  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const to255 = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${to255(r)}${to255(g)}${to255(b)}`;
}

/** Apply the octave light/dark ramp to a base pitch-class color. */
export function octaveTint(hex: string, noteNumber: number): string {
  const oct = Math.floor(noteNumber / 12) - 1; // MIDI: C4 = 60 -> octave 4
  const d = oct - BASE_OCTAVE;
  if (d === 0) return hex;
  const { h, s, l } = hexToHsl(hex);
  if (d < 0) {
    return hslToHex(
      h,
      s * ramp(DOWN_SATURATION, -d),
      Math.max(0.08, l * Math.pow(0.53, -d)),
    );
  }
  const newL = Math.min(0.95, 1 - (1 - l) * ramp(UP_LIGHTNESS, d));
  return hslToHex(h, s * ramp(UP_SATURATION, d), newL);
}

/**
 * Octave-tinted color for a MIDI note. Pass the reactive `$activeColorMap`
 * from components so palette switches re-render; canvas render loops may
 * omit it and get the current palette.
 */
export function colorForNote(noteNumber: number, palette: string[] = currentColors): string {
  const pc = ((noteNumber % 12) + 12) % 12;
  return octaveTint(palette[pc] || '#888', noteNumber);
}

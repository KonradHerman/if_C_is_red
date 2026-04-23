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
    description: 'The original palette — a warm chromatic rainbow pinned at C.',
    colors: [
      '#db3132', '#d54bfa', '#9f70f9', '#819afe',
      '#61acd7', '#7bd8bc', '#7bd559', '#8fd833',
      '#afbc2e', '#d4a426', '#e88e20', '#e3936e',
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

// Re-export color helpers for legacy callers. New code should import from
// ./colorMappings.ts directly and use activeColorMap.
export { colorFor, activeColorMap, COLOR_MAPPINGS } from './colorMappings';

export const keyboardToNoteMap: { [key: string]: number } = {
  // Bottom Row (Notes below Middle C / C4)
  'z': 53,  // F3
  'x': 54,  // F#3
  'c': 55,  // G3
  'v': 56,  // G#3
  'b': 57,  // A3
  'n': 58,  // A#3
  'm': 59,  // B3

  // Middle Row (Starting Middle C / C4)
  'a': 60,  // C4
  's': 61,  // C#4
  'd': 62,  // D4
  'f': 63,  // D#4
  'g': 64,  // E4
  'h': 65,  // F4
  'j': 66,  // F#4
  'k': 67,  // G4
  'l': 68,  // G#4

  // Top Row (Notes above middle row)
  'q': 69,  // A4
  'w': 70,  // A#4
  'e': 71,  // B4
  'r': 72,  // C5
  't': 73,  // C#5
  'y': 74,  // D5
  'u': 75,  // D#5
  'i': 76,  // E5
  'o': 77,  // F5
  'p': 78   // F#5
};

// Layout-independent fallback: maps physical key codes (which don't change
// with caps lock, shift state, or keyboard layout) to the QWERTY letters
// used in `keyboardToNoteMap`. Used when event.key lookup misses.
export const codeToKeyMap: { [code: string]: string } = {
  KeyZ: 'z', KeyX: 'x', KeyC: 'c', KeyV: 'v', KeyB: 'b', KeyN: 'n', KeyM: 'm',
  KeyA: 'a', KeyS: 's', KeyD: 'd', KeyF: 'f', KeyG: 'g', KeyH: 'h', KeyJ: 'j', KeyK: 'k', KeyL: 'l',
  KeyQ: 'q', KeyW: 'w', KeyE: 'e', KeyR: 'r', KeyT: 't', KeyY: 'y', KeyU: 'u', KeyI: 'i', KeyO: 'o', KeyP: 'p',
};

/**
 * Resolve a KeyboardEvent to the QWERTY letter used in keyboardToNoteMap.
 * Robust against case (shift, caps lock) and layout (AZERTY etc.) because
 * it falls back to the physical event.code when event.key doesn't match.
 */
export function resolveNoteKey(e: KeyboardEvent): string | null {
  const low = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (low in keyboardToNoteMap) return low;
  const viaCode = codeToKeyMap[e.code];
  if (viaCode) return viaCode;
  return null;
}

/** Legacy constant noteToColorMap kept for any external code that imported it. */
import { COLOR_MAPPINGS } from './colorMappings';
export const noteToColorMap: { [key: number]: string } = (() => {
  const pal = COLOR_MAPPINGS[0].colors;
  const out: { [k: number]: string } = {};
  pal.forEach((c, i) => { out[i] = c; });
  return out;
})();

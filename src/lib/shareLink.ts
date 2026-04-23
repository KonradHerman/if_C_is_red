import { get } from 'svelte/store';
import {
  selectedInstrumentName,
  selectedVisualizerName,
  selectedTheme,
} from './stores';
import { selectedColorMappingId, customColors } from './colorMappings';
import { recordedSeq, type Sequence } from './sequencer';

/**
 * Serializes/deserializes {instrument, visualizer, theme, colorMapping, sequence}
 * into the URL hash so people can share a setup.
 */

interface SharePayload {
  i: string;       // instrument
  v: string;       // visualizer
  t: string;       // theme
  cm: string;      // color mapping id
  cc?: string[];   // custom colors (only if cm === 'custom')
  seq?: Sequence;
}

function isSequence(value: unknown): value is Sequence {
  if (!value || typeof value !== 'object') return false;
  const maybe = value as Sequence;
  return Array.isArray(maybe.events) && typeof maybe.duration === 'number';
}

export function buildShareUrl(seq?: Sequence | null): string {
  const payload: SharePayload = {
    i: get(selectedInstrumentName),
    v: get(selectedVisualizerName),
    t: get(selectedTheme),
    cm: get(selectedColorMappingId),
  };
  if (payload.cm === 'custom') payload.cc = get(customColors);
  if (seq) payload.seq = seq;
  const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));
  const url = new URL(window.location.href);
  url.hash = 'p=' + encoded;
  return url.toString();
}

export function readShareFromUrl(): SharePayload | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace(/^#/, '');
  const m = /p=([^&]+)/.exec(hash);
  if (!m) return null;
  try {
    return JSON.parse(decodeURIComponent(atob(m[1]))) as SharePayload;
  } catch (e) {
    console.warn('Invalid share payload', e);
    return null;
  }
}

export function applyShare(payload: SharePayload) {
  if (payload.i) selectedInstrumentName.set(payload.i);
  if (payload.v) selectedVisualizerName.set(payload.v);
  if (payload.t) selectedTheme.set(payload.t);
  if (payload.cm) selectedColorMappingId.set(payload.cm);
  if (payload.cc) customColors.set(payload.cc);
  if (isSequence(payload.seq)) recordedSeq.set(payload.seq);
}

export async function copyShareUrl(seq?: Sequence | null): Promise<boolean> {
  const url = buildShareUrl(seq);
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch (e) {
    console.warn('Clipboard write failed', e);
    return false;
  }
}

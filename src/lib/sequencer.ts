import { writable, get } from 'svelte/store';
import * as Tone from 'tone';
import { activeNotes, synthInstance, isAudioReady, audioControls } from './stores';

/**
 * A tiny MIDI-level recorder: captures note-on / note-off timestamps and
 * plays them back. Output goes through the same synth the user is using, so
 * all visualizers animate exactly as during recording.
 */

export interface SequenceEvent {
  t: number;        // ms since sequence start
  type: 'on' | 'off';
  note: number;     // MIDI note number
  velocity: number; // 0-1
}

export interface Sequence {
  events: SequenceEvent[];
  duration: number; // ms
}

export const isRecording  = writable<boolean>(false);
export const isPlaying    = writable<boolean>(false);
export const recordedSeq  = writable<Sequence | null>(null);
export const recordingTime = writable<number>(0);

let recordStart = 0;
let recordTimer: number | null = null;
let recordBuffer: SequenceEvent[] = [];
let activeAtStart = new Set<string | number>();

export function startRecording() {
  recordBuffer = [];
  recordStart = performance.now();
  activeAtStart = new Set(get(activeNotes).keys());
  isRecording.set(true);
  recordingTime.set(0);

  // Hook into activeNotes changes to log events.
  unsubRecord = activeNotes.subscribe(($notes) => {
    if (!get(isRecording)) return;
    const t = performance.now() - recordStart;
    const currentIds = new Set($notes.keys());

    // Notes that appeared since last snapshot => note-on
    currentIds.forEach((id) => {
      if (!prevIds.has(id) && !activeAtStart.has(id)) {
        const n = $notes.get(id);
        if (n) recordBuffer.push({ t, type: 'on', note: n.noteNumber, velocity: n.velocity });
      }
    });
    // Notes that disappeared => note-off
    prevIds.forEach((id) => {
      if (!currentIds.has(id)) {
        const n = prevSnapshot.get(id);
        if (n) recordBuffer.push({ t, type: 'off', note: n.noteNumber, velocity: n.velocity });
      }
    });

    prevIds = currentIds;
    prevSnapshot = new Map($notes);
  });

  recordTimer = window.setInterval(() => {
    recordingTime.set((performance.now() - recordStart) / 1000);
  }, 100);
}

let prevIds: Set<string | number> = new Set();
let prevSnapshot: Map<string | number, { noteNumber: number; velocity: number }> = new Map();
let unsubRecord: (() => void) | null = null;

export function stopRecording(): Sequence | null {
  if (!get(isRecording)) return null;
  isRecording.set(false);
  if (recordTimer) { clearInterval(recordTimer); recordTimer = null; }
  if (unsubRecord) { unsubRecord(); unsubRecord = null; }

  const duration = performance.now() - recordStart;
  const seq: Sequence = { events: [...recordBuffer], duration };
  recordedSeq.set(seq);
  prevIds = new Set();
  prevSnapshot = new Map();
  return seq;
}

let playbackTimeouts: number[] = [];

export async function playSequence(seq: Sequence | null) {
  if (!seq) seq = get(recordedSeq);
  if (!seq || seq.events.length === 0) return;

  const controls = get(audioControls);
  if (!get(isAudioReady) && controls?.initAudio) await controls.initAudio();

  stopPlayback();
  isPlaying.set(true);

  const synth = get(synthInstance);
  if (!synth) { isPlaying.set(false); return; }

  const starts = new Map<number, string>();
  seq.events.forEach((ev, i) => {
    const timeoutId = window.setTimeout(() => {
      const noteName = Tone.Frequency(ev.note, 'midi').toNote();
      const id = `seq-${ev.note}`;
      if (ev.type === 'on') {
        starts.set(ev.note, id);
        synth.triggerAttack(noteName, Tone.now(), ev.velocity);
        activeNotes.update((m) => {
          m.set(id, { id, noteNumber: ev.note, velocity: ev.velocity });
          return m;
        });
      } else {
        synth.triggerRelease(noteName, Tone.now());
        activeNotes.update((m) => { m.delete(id); return m; });
        starts.delete(ev.note);
      }
    }, ev.t);
    playbackTimeouts.push(timeoutId);
  });

  const endId = window.setTimeout(() => {
    isPlaying.set(false);
    // Clean up any stragglers.
    activeNotes.update((m) => {
      [...m.keys()].forEach((k) => { if (String(k).startsWith('seq-')) m.delete(k); });
      return m;
    });
  }, seq.duration + 200);
  playbackTimeouts.push(endId);
}

export function stopPlayback() {
  playbackTimeouts.forEach(clearTimeout);
  playbackTimeouts = [];
  const synth = get(synthInstance);
  if (synth && 'releaseAll' in synth) synth.releaseAll();
  activeNotes.update((m) => {
    [...m.keys()].forEach((k) => { if (String(k).startsWith('seq-')) m.delete(k); });
    return m;
  });
  isPlaying.set(false);
}

export function clearRecording() {
  stopPlayback();
  recordedSeq.set(null);
}

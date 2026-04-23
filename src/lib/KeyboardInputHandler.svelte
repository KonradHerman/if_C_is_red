<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import {
    activeNotes as activeNotesStore,
    synthInstance,
    isAudioReady as isAudioReadyStore,
    audioControls,
    keyboardOctaveOffset,
    sustainPedalDown,
  } from './stores';
  import { keyboardToNoteMap } from './mappings';
  import * as Tone from 'tone';

  const pressedKeyboardKeys: Map<string, { noteName: string; noteId: string }> = new Map();
  // Notes whose physical keys were released but are held by sustain pedal.
  const sustainedOnRelease: Set<string> = new Set();

  // Row-based velocity so playing the bottom row punches a bit more than top.
  function velocityForKey(key: string, shift: boolean): number {
    const topRow    = 'qwertyuiop';
    const midRow    = 'asdfghjkl';
    const bottomRow = 'zxcvbnm';
    let base = 0.7;
    if (topRow.includes(key))    base = 0.55;
    if (midRow.includes(key))    base = 0.72;
    if (bottomRow.includes(key)) base = 0.88;
    return Math.min(1, shift ? base * 1.2 : base);
  }

  async function handleKeyDown(event: KeyboardEvent) {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;

    // Octave shift shortcuts.
    if (event.key === 'ArrowUp')   { keyboardOctaveOffset.update((o) => Math.min(3, o + 1));  event.preventDefault(); return; }
    if (event.key === 'ArrowDown') { keyboardOctaveOffset.update((o) => Math.max(-3, o - 1)); event.preventDefault(); return; }

    if (event.repeat || pressedKeyboardKeys.has(event.key)) return;
    const baseNote = keyboardToNoteMap[event.key];
    if (baseNote === undefined) return;
    event.preventDefault();

    const noteNumber = baseNote + get(keyboardOctaveOffset) * 12;
    const controls = get(audioControls);
    if (!get(isAudioReadyStore) && controls?.initAudio) {
      try { await controls.initAudio(); } catch (e) { return; }
      if (!get(isAudioReadyStore)) return;
    } else if (!get(isAudioReadyStore)) return;

    const noteName = Tone.Frequency(noteNumber, 'midi').toNote();
    const noteId = `key-${event.key}-${noteNumber}`;
    const velocity = velocityForKey(event.key, event.shiftKey);

    pressedKeyboardKeys.set(event.key, { noteName, noteId });
    sustainedOnRelease.delete(noteId);

    const synth = get(synthInstance);
    if (synth) {
      synth.triggerAttack(noteName, Tone.now(), velocity);
      activeNotesStore.update((m) => {
        m.set(noteId, { id: noteId, noteNumber, velocity });
        return m;
      });
    }
  }

  function handleKeyUp(event: KeyboardEvent) {
    const info = pressedKeyboardKeys.get(event.key);
    if (!info) return;

    const { noteName, noteId } = info;
    pressedKeyboardKeys.delete(event.key);

    if (get(sustainPedalDown)) {
      sustainedOnRelease.add(noteId);
      return;
    }

    const synth = get(synthInstance);
    if (synth) synth.triggerRelease(noteName, Tone.now());
    activeNotesStore.update((m) => { m.delete(noteId); return m; });
  }

  // When sustain pedal lifts, release everything we were holding.
  sustainPedalDown.subscribe((down) => {
    if (down) return;
    if (sustainedOnRelease.size === 0) return;
    const synth = get(synthInstance);
    sustainedOnRelease.forEach((noteId) => {
      const state = activeNotesStore;
      const $notes = get(state);
      const n = $notes.get(noteId);
      if (n) {
        const name = Tone.Frequency(n.noteNumber, 'midi').toNote();
        synth?.triggerRelease(name, Tone.now());
        activeNotesStore.update((m) => { m.delete(noteId); return m; });
      }
    });
    sustainedOnRelease.clear();
  });

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  });
</script>

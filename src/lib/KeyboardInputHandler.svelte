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
  import { keyboardToNoteMap, resolveNoteKey } from './mappings';
  import * as Tone from 'tone';

  // Toggle with `?keydebug` / `#keydebug` in the URL; logs every keydown the
  // app sees. Left in production so users can self-diagnose.
  const KEY_DEBUG = typeof window !== 'undefined'
    && /[?#&]keydebug\b/.test(window.location.search + window.location.hash);
  const klog = (...args: unknown[]) => { if (KEY_DEBUG) console.log('[keys]', ...args); };

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

  function targetIsEditable(target: EventTarget | null): boolean {
    const el = target as (HTMLElement | null);
    if (!el) return false;
    const tag = el.tagName;
    // Deliberately does NOT include generic buttons, color pickers, etc.
    // Letter/number keys on a focused <button> should still play notes.
    if (tag === 'INPUT') {
      const t = (el as HTMLInputElement).type;
      if (t === 'text' || t === 'search' || t === 'url' || t === 'email' || t === 'password' || t === 'number') return true;
      return false;
    }
    if (tag === 'TEXTAREA') return true;
    if ((el as HTMLElement).isContentEditable) return true;
    return false;
  }

  async function handleKeyDown(event: KeyboardEvent) {
    klog('keydown', { key: event.key, code: event.code, repeat: event.repeat, target: (event.target as HTMLElement)?.tagName });

    if (targetIsEditable(event.target)) { klog('skip: editable target'); return; }

    // Octave shift shortcuts (let modifier-combinations through to browser).
    if (!event.ctrlKey && !event.metaKey && !event.altKey) {
      if (event.key === 'ArrowUp')   { keyboardOctaveOffset.update((o) => Math.min(3, o + 1));  event.preventDefault(); return; }
      if (event.key === 'ArrowDown') { keyboardOctaveOffset.update((o) => Math.max(-3, o - 1)); event.preventDefault(); return; }
    }

    // Don't steal modifier chords like Ctrl+A, Cmd+R etc.
    if (event.ctrlKey || event.metaKey || event.altKey) { klog('skip: modifier'); return; }

    const noteKey = resolveNoteKey(event);
    if (noteKey === null) { klog('skip: unmapped', event.key, event.code); return; }

    if (event.repeat || pressedKeyboardKeys.has(noteKey)) { klog('skip: repeat/held', noteKey); return; }

    const mapped = keyboardToNoteMap[noteKey];
    if (mapped === undefined) { klog('skip: no base note after resolve'); return; }
    event.preventDefault();

    const noteNumber = mapped + get(keyboardOctaveOffset) * 12;
    const noteName = Tone.Frequency(noteNumber, 'midi').toNote();
    const noteId = `key-${noteKey}-${noteNumber}`;
    const velocity = velocityForKey(noteKey, event.shiftKey);

    // Register BEFORE any await so keyup can always find it.
    pressedKeyboardKeys.set(noteKey, { noteName, noteId });
    sustainedOnRelease.delete(noteId);

    const controls = get(audioControls);
    if (!get(isAudioReadyStore) && controls?.initAudio) {
      klog('initAudio begin');
      try { await controls.initAudio(); } catch (e) {
        console.error('[keys] initAudio threw', e);
        pressedKeyboardKeys.delete(noteKey);
        return;
      }
      klog('initAudio end, audioReady=', get(isAudioReadyStore));
      if (!get(isAudioReadyStore)) { pressedKeyboardKeys.delete(noteKey); return; }
    } else if (!get(isAudioReadyStore)) {
      klog('skip: audio not ready and no initAudio control');
      pressedKeyboardKeys.delete(noteKey);
      return;
    }

    if (!pressedKeyboardKeys.has(noteKey)) { klog('skip: released during init'); return; }

    const synth = get(synthInstance);
    if (synth) {
      klog('triggerAttack', noteName, velocity);
      synth.triggerAttack(noteName, Tone.now(), velocity);
      activeNotesStore.update((m) => {
        m.set(noteId, { id: noteId, noteNumber, velocity });
        return m;
      });
    } else {
      klog('no synth instance');
    }
  }

  function handleKeyUp(event: KeyboardEvent) {
    const noteKey = resolveNoteKey(event);
    if (noteKey === null) return;
    const info = pressedKeyboardKeys.get(noteKey);
    if (!info) return;

    const { noteName, noteId } = info;
    pressedKeyboardKeys.delete(noteKey);

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
    const notes = get(activeNotesStore);
    sustainedOnRelease.forEach((noteId) => {
      const n = notes.get(noteId);
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

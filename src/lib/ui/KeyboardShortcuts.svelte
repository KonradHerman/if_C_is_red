<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import {
    selectedInstrumentName,
    instrumentOptions,
    selectedVisualizerName,
    visualizerOptions,
    helpOverlayVisible,
  } from '../stores';
  import { isRecording, startRecording, stopRecording } from '../sequencer';
  import { playUISound } from './UISounds';

  function cycleInstrument(direction: 1 | -1) {
    const current = get(selectedInstrumentName);
    const idx = instrumentOptions.findIndex((o) => o.name === current);
    const next = (idx + direction + instrumentOptions.length) % instrumentOptions.length;
    selectedInstrumentName.set(instrumentOptions[next].name);
    playUISound('click');
  }

  function pickVisualizer(i: number) {
    if (i < 0 || i >= visualizerOptions.length) return;
    selectedVisualizerName.set(visualizerOptions[i].name);
    playUISound('click');
  }

  function targetIsEditable(target: EventTarget | null): boolean {
    const el = target as (HTMLElement | null);
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT') {
      const t = (el as HTMLInputElement).type;
      if (t === 'text' || t === 'search' || t === 'url' || t === 'email' || t === 'password' || t === 'number') return true;
      return false;
    }
    if (tag === 'TEXTAREA') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function handler(e: KeyboardEvent) {
    if (targetIsEditable(e.target)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === '?' || (e.shiftKey && e.key === '/')) {
      helpOverlayVisible.update((v) => !v);
      e.preventDefault();
      return;
    }
    if (e.key === 'Escape') {
      helpOverlayVisible.set(false);
      return;
    }
    if (e.key === 'Tab') return;

    // Number keys select visualizer (1..9). Digits 1-9 map to first 9 visualizers.
    if (/^[1-9]$/.test(e.key)) {
      const idx = parseInt(e.key, 10) - 1;
      if (idx < visualizerOptions.length) {
        pickVisualizer(idx);
        e.preventDefault();
      }
      return;
    }
    if (e.key === '0') {
      if (visualizerOptions[9]) pickVisualizer(9);
      return;
    }

    if (e.key === '[') { cycleInstrument(-1); e.preventDefault(); return; }
    if (e.key === ']') { cycleInstrument(1);  e.preventDefault(); return; }

    if (e.key === ' ') {
      if (get(isRecording)) stopRecording();
      else startRecording();
      playUISound('record');
      e.preventDefault();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });
</script>

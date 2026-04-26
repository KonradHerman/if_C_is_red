<script lang="ts">
  import { onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import * as Tone from 'tone';
  import {
    activeNotes,
    audioControls,
    isAudioReady,
    onscreenPianoVisible,
    synthInstance,
  } from '../stores';
  import { activeColorMap } from '../colorMappings';
  import { pitchClass } from '../noteGeometry';

  const firstWhiteOctave = 3; // C3
  const octaves = 3;

  interface Key { note: number; isBlack: boolean; whiteIdx: number; }
  const keys: Key[] = [];
  let whiteCount = 0;
  for (let o = 0; o < octaves; o++) {
    for (let pc = 0; pc < 12; pc++) {
      const note = (firstWhiteOctave + 1 + o) * 12 + pc;
      const black = pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
      if (!black) whiteCount++;
      keys.push({ note, isBlack: black, whiteIdx: whiteCount - 1 });
    }
  }

  const pressedPointerIds = new Map<number, number>(); // pointerId -> note

  async function ensureAudio() {
    if (!get(isAudioReady)) {
      const c = get(audioControls);
      if (c?.initAudio) await c.initAudio();
    }
  }

  async function press(note: number, pointerId: number, velocity = 0.8) {
    await ensureAudio();
    const synth = get(synthInstance);
    if (!synth) return;
    const id = `piano-${note}`;
    const name = Tone.Frequency(note, 'midi').toNote();
    synth.triggerAttack(name, Tone.now(), velocity);
    activeNotes.update((m) => { m.set(id, { id, noteNumber: note, velocity }); return m; });
    pressedPointerIds.set(pointerId, note);
  }

  function release(pointerId: number) {
    const note = pressedPointerIds.get(pointerId);
    if (note === undefined) return;
    pressedPointerIds.delete(pointerId);
    const synth = get(synthInstance);
    const id = `piano-${note}`;
    const name = Tone.Frequency(note, 'midi').toNote();
    synth?.triggerRelease(name, Tone.now());
    activeNotes.update((m) => { m.delete(id); return m; });
  }

  function handlePointerDown(e: PointerEvent, note: number) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    press(note, e.pointerId);
  }
  function handlePointerUp(e: PointerEvent)    { release(e.pointerId); }
  function handlePointerCancel(e: PointerEvent) { release(e.pointerId); }

  onDestroy(() => {
    // Release any stuck notes.
    pressedPointerIds.forEach((_, pid) => release(pid));
  });

  function toggle() { onscreenPianoVisible.update((v) => !v); }
</script>

{#if $onscreenPianoVisible}
  <div class="piano-wrap">
    <div
      class="piano"
      style="--white-count: {whiteCount}"
    >
      {#each keys as key (key.note)}
        {#if !key.isBlack}
          {@const c = $activeColorMap[pitchClass(key.note)]}
          {@const active = [...$activeNotes.values()].some(n => n.noteNumber === key.note)}
          <button
            class="white"
            class:active
            style="--c:{c}"
            on:pointerdown={(e) => handlePointerDown(e, key.note)}
            on:pointerup={handlePointerUp}
            on:pointercancel={handlePointerCancel}
            on:pointerleave={handlePointerUp}
            aria-label={`Note ${key.note}`}
          ></button>
        {/if}
      {/each}
      {#each keys as key (key.note + '-black')}
        {#if key.isBlack}
          {@const c = $activeColorMap[pitchClass(key.note)]}
          {@const active = [...$activeNotes.values()].some(n => n.noteNumber === key.note)}
          <button
            class="black"
            class:active
            style="--c:{c}; left: calc((var(--white-w)) * {key.whiteIdx + 1} - var(--black-w) / 2)"
            on:pointerdown={(e) => handlePointerDown(e, key.note)}
            on:pointerup={handlePointerUp}
            on:pointercancel={handlePointerCancel}
            on:pointerleave={handlePointerUp}
            aria-label={`Note ${key.note}`}
          ></button>
        {/if}
      {/each}
    </div>
  </div>
{/if}

<style>
  .piano-wrap {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 90;
    padding: 12px 16px 16px;
    background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.6) 100%);
    pointer-events: none;
  }
  .piano {
    --white-w: calc(100% / var(--white-count));
    --black-w: calc(var(--white-w) * 0.6);
    position: relative;
    height: 160px;
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    background: transparent;
    touch-action: none;
    pointer-events: auto;
    border-radius: 8px;
    overflow: hidden;
  }

  .white {
    flex: 1;
    background: #f7f7f0;
    border: 1px solid rgba(0,0,0,0.3);
    border-top: none;
    border-radius: 0 0 6px 6px;
    padding: 0;
    cursor: pointer;
    transition: background 0.08s;
    box-shadow: inset 0 -4px 12px rgba(0,0,0,0.08);
  }
  .white:active, .white.active {
    background: color-mix(in srgb, var(--c) 80%, white);
    box-shadow: inset 0 -2px 6px rgba(0,0,0,0.2);
  }

  .black {
    position: absolute;
    top: 0;
    width: var(--black-w);
    height: 60%;
    background: #0d0d14;
    border: none;
    border-radius: 0 0 4px 4px;
    padding: 0;
    cursor: pointer;
    box-shadow: 0 4px 6px rgba(0,0,0,0.5);
    transition: background 0.08s;
  }
  .black:active, .black.active {
    background: var(--c);
    box-shadow: inset 0 -2px 4px rgba(0,0,0,0.4);
  }
</style>

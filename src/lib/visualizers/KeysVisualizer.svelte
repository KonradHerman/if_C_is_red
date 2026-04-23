<script lang="ts">
  import { activeColorMap } from '../colorMappings';
  import { pitchClass } from '../noteGeometry';
  import type { ActiveNote } from '../stores';

  export let activeNotes: Map<string | number, ActiveNote> = new Map();

  const firstNote = 36; // C2
  const lastNote  = 96; // C7

  const whiteNotes: number[] = [];
  const blackNotes: number[] = [];
  for (let n = firstNote; n <= lastNote; n++) {
    const pc = pitchClass(n);
    const isBlack = pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
    (isBlack ? blackNotes : whiteNotes).push(n);
  }

  const whiteIndex = new Map<number, number>();
  whiteNotes.forEach((n, i) => whiteIndex.set(n, i));

  $: velocityFor = (note: number): number => {
    let v = 0;
    activeNotes.forEach((a) => { if (a.noteNumber === note) v = Math.max(v, a.velocity); });
    return v;
  };
</script>

<div class="container">
  <div class="piano" style="--white-count: {whiteNotes.length}">
    <!-- White keys laid out on a CSS grid so labels render at normal size -->
    <div class="white-row">
      {#each whiteNotes as n, i (n)}
        {@const v = velocityFor(n)}
        {@const pc = pitchClass(n)}
        {@const c = $activeColorMap[pc] || '#888'}
        <div
          class="white"
          class:c-key={pc === 0}
          style="--c:{c}"
          data-active={v > 0}
        >
          <div class="surface" style={v > 0 ? `background: color-mix(in srgb, var(--c) ${40 + v * 50}%, white);` : ''}></div>
          {#if pc === 0}
            <span class="label">C{Math.floor(n / 12) - 1}</span>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Black keys absolutely positioned over the grid -->
    <div class="black-row">
      {#each blackNotes as n (n)}
        {@const v = velocityFor(n)}
        {@const pc = pitchClass(n)}
        {@const c = $activeColorMap[pc] || '#222'}
        {@const w = whiteIndex.get(n - 1) ?? 0}
        <div
          class="black"
          style="--c:{c}; left: calc(({w + 1} / var(--white-count)) * 100% - (var(--black-w) / 2));"
          data-active={v > 0}
        ></div>
      {/each}
    </div>
  </div>
</div>

<style>
  .container {
    width: 100vw;
    height: 100vh;
    position: fixed;
    top: 0;
    left: 0;
    background: radial-gradient(ellipse at center, #16161f 0%, #08080f 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6vh 4vw;
    box-sizing: border-box;
  }

  .piano {
    --black-w: calc(100% / var(--white-count) * 0.6);
    position: relative;
    width: 100%;
    height: 50vh;
    max-height: 60vh;
    filter: drop-shadow(0 10px 30px rgba(0,0,0,0.6));
  }

  .white-row {
    display: grid;
    grid-template-columns: repeat(var(--white-count), 1fr);
    height: 100%;
    width: 100%;
    gap: 1px;
    background: rgba(0,0,0,0.35);
    border-radius: 4px;
    overflow: hidden;
  }

  .white {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    padding-bottom: 6px;
    background: #f7f7f0;
    transition: background 0.1s ease-out;
  }
  .white[data-active="true"] > .surface {
    box-shadow: inset 0 -2px 8px rgba(0,0,0,0.15);
  }
  .white .surface {
    position: absolute;
    inset: 0;
    background: transparent;
    transition: background 0.08s ease-out;
    pointer-events: none;
  }
  .white .label {
    position: relative;
    z-index: 1;
    font-family: var(--synth-font-mono, monospace);
    font-size: clamp(8px, 0.9vw, 12px);
    color: rgba(0,0,0,0.5);
    pointer-events: none;
  }

  .black-row {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .black {
    position: absolute;
    top: 0;
    width: var(--black-w);
    height: 62%;
    background: #0d0d14;
    border-radius: 0 0 4px 4px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.5);
    transition: background 0.08s ease-out;
  }
  .black[data-active="true"] {
    background: var(--c);
    box-shadow: inset 0 -2px 6px rgba(0,0,0,0.4), 0 0 12px var(--c);
  }
</style>

<script lang="ts">
  import { activeColorMap } from '../colorMappings';
  import { NOTE_NAMES, pitchClass } from '../noteGeometry';
  import { currentChord } from '../stores';
  import type { ActiveNote } from '../stores';

  export let activeNotes: Map<string | number, ActiveNote> = new Map();

  const size = 600;
  const cx = size / 2;
  const cy = size / 2;
  const ringR = 240;
  const nodeR = 26;

  // Circle of fifths ordering (0=C, 7=G, 2=D, ...)
  const fifthsOrder = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];

  function angleFor(pc: number): number {
    const idx = fifthsOrder.indexOf(pc);
    return (idx / 12) * Math.PI * 2 - Math.PI / 2;
  }

  function pos(pc: number, r = ringR) {
    const a = angleFor(pc);
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  }

  $: activePcs = (() => {
    const m = new Map<number, number>();
    activeNotes.forEach((n) => {
      const pc = pitchClass(n.noteNumber);
      m.set(pc, Math.max(m.get(pc) ?? 0, n.velocity));
    });
    return m;
  })();

  $: activeList = [...activePcs.keys()];

  function lineOpacity(): number {
    return activeList.length >= 2 ? 0.6 : 0;
  }
</script>

<div class="container">
  <svg width="100%" height="100%" viewBox="0 0 {size} {size}" preserveAspectRatio="xMidYMid meet">
    <!-- Subtle background ring -->
    <circle {cx} {cy} r={ringR} fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
    <circle {cx} {cy} r={ringR - 40} fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1" />

    <!-- Connection lines between active notes form the chord shape -->
    {#if activeList.length >= 2}
      <g class="chord-lines" opacity={lineOpacity()}>
        {#each activeList as a, i}
          {#each activeList.slice(i + 1) as b}
            {@const pa = pos(a)}
            {@const pb = pos(b)}
            <line
              x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
              stroke="url(#chord-grad)"
              stroke-width="2.5"
              stroke-linecap="round"
            />
          {/each}
        {/each}
      </g>
    {/if}

    <defs>
      <linearGradient id="chord-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stop-color="rgba(255,255,255,0.9)" />
        <stop offset="100%" stop-color="rgba(255,255,255,0.4)" />
      </linearGradient>
      {#each Array(12) as _, i}
        <radialGradient id={`hw-g-${i}`}>
          <stop offset="0%"  stop-color={$activeColorMap[i]} stop-opacity="1" />
          <stop offset="70%" stop-color={$activeColorMap[i]} stop-opacity="0.7" />
          <stop offset="100%" stop-color={$activeColorMap[i]} stop-opacity="0" />
        </radialGradient>
      {/each}
    </defs>

    <!-- Pitch-class nodes -->
    <g>
      {#each fifthsOrder as pc}
        {@const p = pos(pc)}
        {@const active = activePcs.has(pc)}
        {@const v = activePcs.get(pc) ?? 0}
        <!-- Glow halo -->
        {#if active}
          <circle cx={p.x} cy={p.y} r={nodeR * 2.2} fill={`url(#hw-g-${pc})`} opacity={0.4 + v * 0.5} />
        {/if}
        <circle
          cx={p.x} cy={p.y}
          r={nodeR}
          fill={$activeColorMap[pc]}
          opacity={active ? 0.55 + v * 0.45 : 0.18}
          stroke={active ? 'rgba(255,255,255,0.4)' : 'none'}
          stroke-width={active ? 1.5 : 0}
          style="transition: opacity 0.1s;"
        />
        <text
          x={p.x} y={p.y + 5}
          text-anchor="middle"
          fill={active ? '#fff' : 'rgba(255,255,255,0.65)'}
          font-family="var(--synth-font-mono, monospace)"
          font-size="16"
          font-weight="600"
        >{NOTE_NAMES[pc]}</text>
      {/each}
    </g>

    <!-- Chord readout centered -->
    <g class="chord-readout">
      <circle {cx} {cy} r="75" fill="rgba(0,0,0,0.45)" stroke="rgba(255,255,255,0.08)" />
      {#if $currentChord}
        <text
          x={cx} y={cy + 8}
          text-anchor="middle"
          fill="#fff"
          font-family="var(--synth-font-mono, monospace)"
          font-size="28"
          font-weight="700"
        >{$currentChord.label}</text>
      {:else}
        <text
          x={cx} y={cy + 6}
          text-anchor="middle"
          fill="rgba(255,255,255,0.3)"
          font-family="var(--synth-font-mono, monospace)"
          font-size="14"
          letter-spacing="2"
        >–</text>
      {/if}
    </g>
  </svg>
</div>

<style>
  .container {
    width: 100vw;
    height: 100vh;
    position: fixed;
    top: 0;
    left: 0;
    overflow: hidden;
    background: radial-gradient(ellipse at center, #1a1a2a 0%, #0a0a13 100%);
    display: flex;
    justify-content: center;
    align-items: center;
  }
  svg { max-width: 95vmin; max-height: 95vmin; }
</style>

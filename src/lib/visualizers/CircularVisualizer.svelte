<script lang="ts">
  import { activeColorMap } from '../colorMappings';
  import { NOTE_NAMES, pitchClass } from '../noteGeometry';
  import { currentChord } from '../stores';
  import type { ActiveNote } from '../stores';

  export let activeNotes: Map<string | number, ActiveNote> = new Map();

  const size = 600;
  const centerX = size / 2;
  const centerY = size / 2;
  const innerRadius = 80;
  const outerRadius = 250;
  const segmentCount = 12;
  const segmentAngle = (Math.PI * 2) / segmentCount;
  const gapAngle = 0.02;

  function color(i: number, map: string[]): string { return map[i] || '#888'; }

  function createArcPath(noteIndex: number, innerR: number, outerR: number): string {
    const startAngle = noteIndex * segmentAngle - Math.PI / 2 + gapAngle / 2;
    const endAngle   = (noteIndex + 1) * segmentAngle - Math.PI / 2 - gapAngle / 2;

    const x1 = centerX + Math.cos(startAngle) * innerR;
    const y1 = centerY + Math.sin(startAngle) * innerR;
    const x2 = centerX + Math.cos(endAngle)   * innerR;
    const y2 = centerY + Math.sin(endAngle)   * innerR;
    const x3 = centerX + Math.cos(endAngle)   * outerR;
    const y3 = centerY + Math.sin(endAngle)   * outerR;
    const x4 = centerX + Math.cos(startAngle) * outerR;
    const y4 = centerY + Math.sin(startAngle) * outerR;
    const largeArc = segmentAngle - gapAngle > Math.PI ? 1 : 0;

    return `M ${x1} ${y1} A ${innerR} ${innerR} 0 ${largeArc} 1 ${x2} ${y2}
            L ${x3} ${y3} A ${outerR} ${outerR} 0 ${largeArc} 0 ${x4} ${y4} Z`;
  }

  function isPitchClassActive(notes: Map<string | number, ActiveNote>, pc: number): boolean {
    for (const note of notes.values()) if (pitchClass(note.noteNumber) === pc) return true;
    return false;
  }
</script>

<div class="circular-visualizer-container">
  <svg
    width="100%"
    height="100%"
    viewBox="0 0 {size} {size}"
    preserveAspectRatio="xMidYMid meet"
  >
    <defs>
      {#each Array(12) as _, i}
        <filter id={`blur-${i}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      {/each}
    </defs>

    <g class="background-segments">
      {#each Array(12) as _, i}
        <path
          d={createArcPath(i, innerRadius, outerRadius)}
          fill={color(i, $activeColorMap)}
          opacity="0.15"
        />
      {/each}
    </g>

    <g class="active-segments">
      {#each [...activeNotes] as [id, note] (id)}
        {@const pc = pitchClass(note.noteNumber)}
        <path
          d={createArcPath(pc, innerRadius - 10, outerRadius + 20)}
          fill={color(pc, $activeColorMap)}
          opacity={note.velocity * 0.5}
          filter={`url(#blur-${pc})`}
        />
        <path
          d={createArcPath(pc, innerRadius, outerRadius)}
          fill={color(pc, $activeColorMap)}
          opacity={0.4 + note.velocity * 0.6}
          style="transition: opacity 0.05s ease-out;"
        />
      {/each}
    </g>

    <circle cx={centerX} cy={centerY} r={innerRadius - 10} fill="rgba(255,255,255,0.05)" />
    <circle cx={centerX} cy={centerY} r={innerRadius - 30} fill="rgba(0,0,0,0.3)" />

    {#if $currentChord}
      <text
        x={centerX} y={centerY + 6}
        text-anchor="middle"
        fill="rgba(255,255,255,0.85)"
        font-family="var(--synth-font-mono, monospace)"
        font-size="22"
        font-weight="600"
      >{$currentChord.label}</text>
    {/if}

    <g
      class="labels"
      fill="rgba(255,255,255,0.6)"
      font-size="12"
      text-anchor="middle"
    >
      {#each NOTE_NAMES as label, i}
        {@const angle = i * segmentAngle - Math.PI / 2 + segmentAngle / 2}
        {@const labelRadius = outerRadius + 25}
        {@const isActive = isPitchClassActive(activeNotes, i)}
        <text
          x={centerX + Math.cos(angle) * labelRadius}
          y={centerY + Math.sin(angle) * labelRadius + 4}
          opacity={isActive ? 1 : 0.5}
        >{label}</text>
      {/each}
    </g>
  </svg>
</div>

<style>
  .circular-visualizer-container {
    width: 100vw;
    height: 100vh;
    position: fixed;
    top: 0;
    left: 0;
    overflow: hidden;
    background: radial-gradient(ellipse at center, #1a1a2e 0%, #0f0f1a 100%);
    display: flex;
    justify-content: center;
    align-items: center;
  }
  svg { max-width: 90vh; max-height: 90vh; }
  .active-segments path { transition: opacity 0.08s ease-out; }
</style>

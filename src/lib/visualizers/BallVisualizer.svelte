<script lang="ts">
  import { activeColorMap } from '../colorMappings';
  import { noteXPosition, noteYPosition, pitchClass } from '../noteGeometry';
  import type { ActiveNote } from '../stores';

  export let activeNotes: Map<string | number, ActiveNote> = new Map();

  const viewBoxWidth = 1000;
  const viewBoxHeight = 600;
  const baseRadius = 25;

  const cfg = { viewBoxWidth, viewBoxHeight, middleOctave: 5, octaveCount: 9 };

  function color(noteNumber: number, map: string[]): string {
    return map[pitchClass(noteNumber)] || '#888';
  }
</script>

<div class="visualizer-container">
  <svg
    width="100%"
    height="100%"
    viewBox="0 0 {viewBoxWidth} {viewBoxHeight}"
    preserveAspectRatio="xMidYMid meet"
  >
    <defs>
      {#each [...activeNotes] as [id, note] (id)}
        <radialGradient id={`grad-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stop-color={color(note.noteNumber, $activeColorMap)} stop-opacity="1" />
          <stop offset="100%" stop-color={color(note.noteNumber, $activeColorMap)} stop-opacity="0" />
        </radialGradient>
      {/each}
    </defs>

    <g class="notes-group">
      {#each [...activeNotes] as [id, note] (id)}
        {@const cx = noteXPosition(note.noteNumber, cfg)}
        {@const cy = noteYPosition(note.noteNumber, cfg)}
        <circle
          {cx}
          {cy}
          r={baseRadius * (0.7 + note.velocity * 0.5)}
          fill={`url(#grad-${id})`}
          opacity={note.velocity}
          style="transition: opacity 0.1s;"
        />
      {/each}
    </g>
  </svg>
</div>

<style>
  .visualizer-container {
    width: 100vw;
    height: 100vh;
    position: fixed;
    top: 0;
    left: 0;
    overflow: hidden;
  }

  svg { display: block; }
</style>

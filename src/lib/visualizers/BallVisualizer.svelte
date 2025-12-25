<script lang="ts">
  // Import only the color map
  import { noteToColorMap } from '../mappings'; // Path is now relative to visualizers/ directory
  // Import the type from App.svelte (use relative path)
  import type { ActiveNote } from '../../App.svelte'; // Adjusted path

  // Receive the list of active notes as a prop
  export let activeNotes: Map<string | number, ActiveNote> = new Map();

  // Define dimensions for the visualizer area
  const viewBoxWidth = 1000;
  const viewBoxHeight = 600; // Adjust as needed
  const middleOctave = 5; // Shifted up to center FFT-detected notes better
  const octaveHeight = viewBoxHeight / 9; // More octaves visible
  const baseRadius = 25; // Base radius for circles

  // --- Helper Functions ---

  function getNoteColor(noteNumber: number): string {
    return noteToColorMap[noteNumber % 12] || '#888888';
  }

  function getNoteYPosition(noteNumber: number): number {
    const octave = Math.floor(noteNumber / 12) - 1; // C0=12, C1=24... C4=60
    const octaveDiff = octave - middleOctave;
    // Center Y position for the middle octave
    const middleY = viewBoxHeight / 2;
    // Calculate Y based on octave difference (higher notes = lower Y in SVG)
    // Notes increase in number going up the keyboard, so octaveDiff increases.
    // We subtract it to move higher notes *up* (lower Y value) in the SVG.
    return middleY - octaveDiff * octaveHeight;
  }

  function getNoteXPosition(noteNumber: number): number {
     // Simple horizontal centering for now
     // Spread out slightly based on note within octave to avoid exact overlap
     const noteInOctave = noteNumber % 12;
     const spreadFactor = viewBoxWidth / 14; // Increase spread (decrease divisor)
     return viewBoxWidth / 2 + (noteInOctave - 5.5) * spreadFactor; // Center around 5.5 (between E and F)
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
      <!-- Iterate directly over the activeNotes Map -->
      {#each activeNotes as [id, note] (id)}
         <radialGradient id={`grad-${id}`} cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
           <stop offset="0%" style="stop-color:{getNoteColor(note.noteNumber)};stop-opacity:1" />
           <stop offset="100%" style="stop-color:{getNoteColor(note.noteNumber)};stop-opacity:0" />
         </radialGradient>
      {/each}
    </defs>

    <g class="notes-group">
      <!-- Iterate directly over the activeNotes Map -->
      {#each activeNotes as [id, note] (id)}
        {@const cx = getNoteXPosition(note.noteNumber)}
        {@const cy = getNoteYPosition(note.noteNumber)}
        {@const opacity = note.velocity}
        <circle
          cx={cx}
          cy={cy}
          r={baseRadius}
          fill={`url(#grad-${id})`}
          opacity={opacity}
          style="transition: opacity 0.1s;"
        />
      {/each}
    </g>
  </svg>
</div>

<style>
  .visualizer-container {
    width: 100vw; /* Full viewport width */
    height: 100vh; /* Full viewport height */
    position: fixed; /* Position relative to viewport */
    top: 0;
    left: 0;
    overflow: hidden;
  }

  svg {
    display: block;
  }

  .notes-group circle {
     /* stroke: #fff; */
     /* stroke-width: 1; */
     /* filter: blur(1px); */
  }
</style> 
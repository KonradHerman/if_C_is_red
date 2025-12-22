<script lang="ts">
  import { onMount, onDestroy, beforeUpdate } from 'svelte';
  import type { ActiveNote } from '../../App.svelte'; // Use definition from App
  import { noteToColorMap } from '../mappings'; // Import color map

  // Prop to receive active notes
  export let activeNotes: Map<string | number, ActiveNote>;

  // --- Configuration ---
  // Total time window displayed (ms)
  const timeWindowMs = 5000; 
  // How long note takes to fade after ending (ms)
  const fadeOutDurationMs = 500; 
  // Total pixel width of the SVG coordinate system
  const viewBoxTotalWidth = 1000; 
  // Scale factor: pixels per second
  const pixelsPerSecond = viewBoxTotalWidth / (timeWindowMs / 1000); 
  // Height config
  const viewBoxHeight = 200; // Increased height for octaves
  const middleOctave = 5; // Shifted up to center FFT-detected notes better
  const octaveCount = 9; // More octave slots to visualize
  const barHeight = viewBoxHeight / octaveCount; // Height per octave slot (approx 28.5)

  // --- State ---
  interface RenderedBar {
    id: string | number;
    uniqueId: string; // Add unique identifier for each instance
    noteNumber: number;
    velocity: number; // Store velocity for opacity
    color: string;
    startTime: number;
    endTime: number | null; // null if still active
  }

  let renderedBars: RenderedBar[] = [];
  let now = performance.now();
  let animationFrameId: number;
  let prevActiveNotes: Map<string | number, ActiveNote> = new Map();

  // --- Helper Functions ---
  function getNoteColor(noteNumber: number): string {
    return noteToColorMap[noteNumber % 12] || '#888888'; // Default grey
  }

  // Adapted from BallVisualizer
  function getNoteYPosition(noteNumber: number): number {
    const octave = Math.floor(noteNumber / 12) - 1; // C0=12, C1=24... C4=60
    const octaveDiff = octave - middleOctave;
    // Center Y position for the middle octave slot
    const middleY = viewBoxHeight / 2 - barHeight / 2; // Center the *bar*, not the line
    // Calculate Y based on octave difference (higher notes = lower Y in SVG)
    return middleY - octaveDiff * barHeight; // Move up/down by full bar heights
  }

  // --- Lifecycle & Animation ---
  onMount(() => {
    prevActiveNotes = new Map(activeNotes); // Initialize previous state

    const animate = (timestamp: number) => {
      now = timestamp; // Use RAF timestamp for smooth animation timing & calculations
      // Filtering is now handled in beforeUpdate
      animationFrameId = requestAnimationFrame(animate);
    };
    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  });

  // --- Reactivity: Detect Note Changes ---
  beforeUpdate(() => {
    const updateTime = performance.now(); // Timestamp for note start/end events

    // Use 'now' from the last animation frame for filtering consistency with rendering
    // Time corresponding to the right edge of the view box
    const windowEndTime = now + timeWindowMs / 2;
    // Time corresponding to when a bar completely disappears off the left edge
    const filterStartTime = now - timeWindowMs;

    // 1. Filter out old bars 
    const initialLength = renderedBars.length;
    let barsToKeep = renderedBars.filter(bar => {
        // Use Infinity for active notes, ensuring they are kept until they end
        const effectiveEndTime = bar.endTime ?? Infinity;

        // Condition 1: Keep if the note starts before the right edge of the view.
        const startsBeforeViewEnd = bar.startTime < windowEndTime;

        // Condition 2: Keep if the note's disappearance time is after the filter start time.
        // For active notes (Infinity), this is always true.
        // For ended notes, this ensures they are kept until fully off-screen.
        const endsAfterFilterStart = effectiveEndTime > filterStartTime;

        return startsBeforeViewEnd && endsAfterFilterStart;
    });

    let changed = false;
    const currentIds = new Set(activeNotes.keys());
    const previousIds = new Set(prevActiveNotes.keys());

    // 2. Update existing bars (from the filtered list) that just stopped
    let processedBars = barsToKeep.map(bar => {
       if (bar.endTime === null && previousIds.has(bar.id) && !currentIds.has(bar.id)) {
           changed = true;
           // Use the more precise updateTime for the event itself
           return { ...bar, endTime: updateTime };
       }
       return bar;
    });

    // 3. Add new bars for notes that just started
    currentIds.forEach(id => {
      // This condition ensures we only add truly *new* notes in this cycle
      if (!previousIds.has(id)) {
        const note = activeNotes.get(id);
        if (note) {
          const newBar: RenderedBar = {
            id: note.id,
            noteNumber: note.noteNumber,
            velocity: note.velocity,
            color: getNoteColor(note.noteNumber),
            startTime: updateTime, // Use event time
            endTime: null,
            uniqueId: `${note.id}-${updateTime}` // Generate unique ID
          };
          processedBars.push(newBar); // Add to the list being built
          changed = true;
        }
      }
    });

    prevActiveNotes = new Map(activeNotes);

    // 4. Update the main state if notes started/stopped OR if filtering removed items
    if (changed || processedBars.length !== initialLength) {
       renderedBars = processedBars;
    }
  });

  // --- SVG Coordinate Calculation (Symmetrical Expansion & Outward Movement) ---
  function calculateBarMetrics(bar: RenderedBar, currentTime: number): {
      leftX: number; rightX: number; width: number; y: number; opacity: number; isVisible: boolean
  } {
    const y = getNoteYPosition(bar.noteNumber);
    const pixelsPerMs = pixelsPerSecond / 1000;

    let leftX: number;
    let rightX: number;
    let width: number;

    if (bar.endTime === null) {
        // Note is active: Symmetrical expansion from center
        const activeDurationMs = Math.max(0, currentTime - bar.startTime);
        const halfWidth = (activeDurationMs * pixelsPerMs) / 2;
        // Clamp width to avoid exceeding viewBox boundary visually during growth
        width = Math.min(halfWidth, viewBoxTotalWidth / 2); 
        leftX = -width;
        rightX = 0; // Right rectangle starts at center
    } else {
        // Note has ended: Continue moving outwards
        const finalDurationMs = Math.max(0, bar.endTime - bar.startTime);
        const finalHalfWidth = (finalDurationMs * pixelsPerMs) / 2;
        const elapsedSinceEndMs = Math.max(0, currentTime - bar.endTime);
        // Adjust shift calculation for constant speed
        const outwardShift = elapsedSinceEndMs * (pixelsPerMs / 2); 

        // Width is fixed at the size it was when the note ended
        width = Math.min(finalHalfWidth, viewBoxTotalWidth / 2); 
        leftX = -(width + outwardShift); // Starts further left
        rightX = outwardShift;         // Starts further right
    }
    
    // Clamp width to ensure it's not excessively large if time calculations are off
    width = Math.max(0, width); 

    let opacity = bar.velocity; // Base opacity on velocity

    // Determine visibility based on whether *either* rectangle overlaps the view box
    const viewBoxStartX = -viewBoxTotalWidth / 2;
    const viewBoxEndX = viewBoxTotalWidth / 2;
    
    const leftRectEndX = leftX + width;
    const rightRectEndX = rightX + width;

    const leftVisible = leftX < viewBoxEndX && leftRectEndX > viewBoxStartX;
    const rightVisible = rightX < viewBoxEndX && rightRectEndX > viewBoxStartX;

    // Bar is considered visible if either half is potentially visible and meets minimum width/opacity
    const isVisible = (leftVisible || rightVisible) && width > 0.1 && opacity > 0.01;

    return { leftX, rightX, width, y, opacity, isVisible };
  }

</script>

<div class="bars-visualizer-container">
  <svg
    width="100%"
    height="100%"
    viewBox="{-viewBoxTotalWidth / 2} 0 {viewBoxTotalWidth} {viewBoxHeight}"
    preserveAspectRatio="xMidYMid meet"
  >
    <defs>
      {#each renderedBars as bar (bar.uniqueId)}
        {@const metrics = calculateBarMetrics(bar, now)}
        {#if metrics.isVisible}
          <!-- Gradient fades IN from Left edge (0% transparent -> 20% solid -> 100% solid) -->
          <linearGradient id={`grad-fade-in-${bar.uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color={bar.color} stop-opacity="0" />
            <stop offset="5%" stop-color={bar.color} stop-opacity={metrics.opacity} />
            <stop offset="90%" stop-color={bar.color} stop-opacity={metrics.opacity} />
            <stop offset="100%" stop-color={bar.color} stop-opacity="0" />
          </linearGradient>
          <!-- Gradient fades OUT to Right edge (0% solid -> 80% solid -> 100% transparent) -->
          <linearGradient id={`grad-fade-out-${bar.uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color={bar.color} stop-opacity="0" />
            <stop offset="10%" stop-color={bar.color} stop-opacity={metrics.opacity} />
            <stop offset="95%" stop-color={bar.color} stop-opacity={metrics.opacity} />
            <stop offset="100%" stop-color={bar.color} stop-opacity="0" />
          </linearGradient>
        {/if}
      {/each}
    </defs>
    <g class="bars-group">
      {#each renderedBars as bar (bar.uniqueId)}
        {@const metrics = calculateBarMetrics(bar, now)}
        {#if metrics.isVisible}
          <!-- Left Rectangle (moves left, outer edge is left, needs fade IN from left) -->
          <rect
            x={metrics.leftX}
            y={metrics.y}
            width={metrics.width}
            height={barHeight}
            fill={`url(#grad-fade-in-${bar.uniqueId})`}
            shape-rendering="crispEdges"
          />
          <!-- Right Rectangle (moves right, outer edge is right, needs fade OUT to right) -->
           <rect
            x={metrics.rightX}
            y={metrics.y}
            width={metrics.width}
            height={barHeight}
            fill={`url(#grad-fade-out-${bar.uniqueId})`}
            shape-rendering="crispEdges"
          />
        {/if}
      {/each}
    </g>
    
    <!-- Center Line -->
    <line x1=0 y1=0 x2=0 y2={viewBoxHeight} stroke="rgba(255, 255, 255, 0.5)" stroke-width="1" />

  </svg>
  {#if activeNotes}
    <p>Active Notes: {activeNotes.size}</p>
  {/if}
</div>

<style>
  .bars-visualizer-container {
    width: 100vw; /* Full viewport width */
    height: 100vh; /* Full viewport height */
    position: fixed; /* Position relative to viewport */
    top: 0;
    left: 0;
    overflow: hidden;
  }

  svg {
    display: block;
    background-color: transparent; /* Let container handle bg */
  }

  .bars-group rect {
    /* No transitions needed here, attributes recalculated each frame */
  }
</style> 
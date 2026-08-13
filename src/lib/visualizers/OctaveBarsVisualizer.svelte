<script lang="ts">
  import { onMount, beforeUpdate } from 'svelte';
  import { activeColorMap, colorForNote } from '../colorMappings';
  import { octave } from '../noteGeometry';
  import { barsSpeed } from '../stores';
  import type { ActiveNote } from '../stores';

  export let activeNotes: Map<string | number, ActiveNote> = new Map();

  const baseWindowMs = 5000;
  const viewBoxTotalWidth = 1000;
  const viewBoxHeight = 1000;

  // Faster speed = shorter window on screen = more pixels travelled per second.
  $: timeWindowMs = baseWindowMs / $barsSpeed;
  $: pixelsPerSecond = viewBoxTotalWidth / (timeWindowMs / 1000);

  // Each octave owns a fixed horizontal lane, highest at the top. A note can
  // only ever move *within* its own octave's lane, so adding a note in one
  // octave never shoves notes in another octave up or down — the pitch-sorted
  // allocation in BarsVisualizer reflows every bar on every change, which is
  // what makes it feel jittery.
  const LOW_OCTAVE = 1;   // MIDI 24
  const HIGH_OCTAVE = 7;  // MIDI 107
  const BAND_COUNT = HIGH_OCTAVE - LOW_OCTAVE + 1;

  /** Lane index from the top; notes outside the range clamp into the edge lane. */
  function bandIndex(noteNumber: number): number {
    const oct = Math.max(LOW_OCTAVE, Math.min(HIGH_OCTAVE, octave(noteNumber)));
    return HIGH_OCTAVE - oct;
  }

  interface Segment {
    uniqueId: string;
    noteId: string | number;
    noteNumber: number;
    velocity: number;
    startTime: number;
    endTime: number | null;
    yTop: number;    // 0..1 fraction of viewBoxHeight
    yBottom: number;
    hasSuccessor: boolean;
  }

  let segments: Segment[] = [];
  let now = performance.now();
  let animationFrameId: number;
  let segmentCounter = 0;
  let prevActiveIds: Set<string | number> = new Set();

  // Group the active notes by octave lane, then split each lane evenly among
  // only the notes sounding in that lane (highest pitch on top).
  function computeAllocation(
    notes: ActiveNote[]
  ): Map<string | number, { yTop: number; yBottom: number }> {
    const lanes = new Map<number, ActiveNote[]>();
    for (const note of notes) {
      const band = bandIndex(note.noteNumber);
      const lane = lanes.get(band);
      if (lane) lane.push(note);
      else lanes.set(band, [note]);
    }

    const result = new Map<string | number, { yTop: number; yBottom: number }>();
    const laneHeight = 1 / BAND_COUNT;
    lanes.forEach((laneNotes, band) => {
      const sorted = [...laneNotes].sort((a, b) => b.noteNumber - a.noteNumber);
      const n = sorted.length;
      const laneTop = band * laneHeight;
      sorted.forEach((note, i) => {
        result.set(note.id, {
          yTop: laneTop + (i / n) * laneHeight,
          yBottom: laneTop + ((i + 1) / n) * laneHeight,
        });
      });
    });
    return result;
  }

  function reallocate(t: number) {
    const nextIds = new Set(activeNotes.keys());
    for (const seg of segments) {
      if (seg.endTime === null) {
        seg.endTime = t;
        seg.hasSuccessor = nextIds.has(seg.noteId);
      }
    }
    const current = [...activeNotes.values()];
    if (current.length === 0) return;
    const alloc = computeAllocation(current);
    for (const note of current) {
      const slot = alloc.get(note.id);
      if (!slot) continue;
      segments.push({
        uniqueId: `${note.id}-${segmentCounter++}`,
        noteId: note.id,
        noteNumber: note.noteNumber,
        velocity: note.velocity,
        startTime: t,
        endTime: null,
        yTop: slot.yTop,
        yBottom: slot.yBottom,
        hasSuccessor: false,
      });
    }
  }

  onMount(() => {
    const animate = (ts: number) => {
      // Only drive a re-render when there is something to animate; an idle
      // visualizer shouldn't repaint the whole SVG 60x a second.
      if (segments.length > 0) now = ts;
      animationFrameId = requestAnimationFrame(animate);
    };
    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  });

  beforeUpdate(() => {
    const t = performance.now();

    const currentIds = new Set(activeNotes.keys());
    let setChanged = currentIds.size !== prevActiveIds.size;
    if (!setChanged) {
      for (const id of currentIds) {
        if (!prevActiveIds.has(id)) { setChanged = true; break; }
      }
    }

    if (setChanged) {
      // Close segments "as of" the last frame so successors already have
      // non-zero width when first drawn (no one-frame seam flash).
      const closeAt = Math.max(now, t - 20);
      reallocate(closeAt);
      prevActiveIds = currentIds;
    }

    now = t;

    const cutoff = t - timeWindowMs;
    const before = segments.length;
    const kept = segments.filter((s) => (s.endTime ?? Infinity) > cutoff);
    if (setChanged || kept.length !== before) segments = kept;
  });

  function metrics(seg: Segment, t: number) {
    const pxPerMs = pixelsPerSecond / 1000;
    const segEnd = seg.endTime ?? t;
    const innerShift = Math.max(0, (t - segEnd) * pxPerMs / 2);
    const outerShift = Math.max(0, (t - seg.startTime) * pxPerMs / 2);

    const vbEnd = viewBoxTotalWidth / 2;
    const clampedOuter = Math.min(outerShift, vbEnd);
    const clampedInner = Math.min(innerShift, vbEnd);
    const width = Math.max(0, clampedOuter - clampedInner);

    const y = seg.yTop * viewBoxHeight;
    const height = (seg.yBottom - seg.yTop) * viewBoxHeight;
    const fadeInner = !seg.hasSuccessor;
    const visible = width > 0.1 && seg.velocity > 0.01 && clampedInner < vbEnd;

    return {
      leftX: -clampedOuter,
      rightX: clampedInner,
      width,
      y,
      height,
      opacity: seg.velocity,
      visible,
      fadeInner,
    };
  }

  const laneGuides = Array.from({ length: BAND_COUNT }, (_, i) => ({
    y: (i / BAND_COUNT) * viewBoxHeight,
    label: `C${HIGH_OCTAVE - i}`,
  }));
</script>

<div class="bars-visualizer-container">
  <svg
    width="100%"
    height="100%"
    viewBox="{-viewBoxTotalWidth / 2} 0 {viewBoxTotalWidth} {viewBoxHeight}"
    preserveAspectRatio="none"
  >
    <defs>
      {#each segments as seg (seg.uniqueId)}
        {@const m = metrics(seg, now)}
        {@const c = colorForNote(seg.noteNumber, $activeColorMap)}
        {#if m.visible && m.fadeInner}
          <linearGradient id={`ograd-l-${seg.uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stop-color={c} stop-opacity={m.opacity} />
            <stop offset="70%"  stop-color={c} stop-opacity={m.opacity} />
            <stop offset="100%" stop-color={c} stop-opacity="0" />
          </linearGradient>
          <linearGradient id={`ograd-r-${seg.uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stop-color={c} stop-opacity="0" />
            <stop offset="30%"  stop-color={c} stop-opacity={m.opacity} />
            <stop offset="100%" stop-color={c} stop-opacity={m.opacity} />
          </linearGradient>
        {/if}
      {/each}
    </defs>

    <!-- Fixed octave lanes, so the structure reads even while nothing plays -->
    <g class="lane-guides">
      {#each laneGuides as lane, i}
        {#if i > 0}
          <line
            x1={-viewBoxTotalWidth / 2} y1={lane.y}
            x2={viewBoxTotalWidth / 2}  y2={lane.y}
            stroke="rgba(255,255,255,0.07)" stroke-width="1"
            vector-effect="non-scaling-stroke"
          />
        {/if}
      {/each}
    </g>

    <g class="bars-group">
      {#each segments as seg (seg.uniqueId)}
        {@const m = metrics(seg, now)}
        {@const c = colorForNote(seg.noteNumber, $activeColorMap)}
        {#if m.visible}
          <rect x={m.leftX}  y={m.y} width={m.width} height={m.height}
                fill={m.fadeInner ? `url(#ograd-l-${seg.uniqueId})` : c}
                opacity={m.fadeInner ? 1 : m.opacity}
                shape-rendering="crispEdges" />
          <rect x={m.rightX} y={m.y} width={m.width} height={m.height}
                fill={m.fadeInner ? `url(#ograd-r-${seg.uniqueId})` : c}
                opacity={m.fadeInner ? 1 : m.opacity}
                shape-rendering="crispEdges" />
        {/if}
      {/each}
    </g>

    <line x1=0 y1=0 x2=0 y2={viewBoxHeight}
          stroke="rgba(255, 255, 255, 0.5)" stroke-width="1"
          vector-effect="non-scaling-stroke" />
  </svg>

  <!-- Octave labels sit outside the SVG so they don't stretch with
       preserveAspectRatio="none". -->
  <div class="lane-labels">
    {#each laneGuides as lane}
      <span class="lane-label" style="top: {(lane.y / viewBoxHeight) * 100}%">{lane.label}</span>
    {/each}
  </div>
</div>

<style>
  .bars-visualizer-container {
    width: 100vw;
    height: 100vh;
    position: fixed;
    top: 0;
    left: 0;
    overflow: hidden;
  }
  svg { display: block; background-color: transparent; }

  .lane-labels {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .lane-label {
    position: absolute;
    left: 8px;
    transform: translateY(2px);
    font-family: var(--synth-font-mono, monospace);
    font-size: 10px;
    color: rgba(255, 255, 255, 0.3);
  }
</style>

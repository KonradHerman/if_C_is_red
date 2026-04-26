<script lang="ts">
  import { onMount, beforeUpdate } from 'svelte';
  import { activeColorMap } from '../colorMappings';
  import { pitchClass } from '../noteGeometry';
  import type { ActiveNote } from '../stores';

  export let activeNotes: Map<string | number, ActiveNote> = new Map();

  const timeWindowMs = 5000;
  const viewBoxTotalWidth = 1000;
  const pixelsPerSecond = viewBoxTotalWidth / (timeWindowMs / 1000);
  const viewBoxHeight = 1000;

  // A Segment describes a time-slice during which a given note held a specific
  // vertical slot in the overall allocation. When the set of active notes
  // changes, each current segment is closed and replaced with a new one that
  // reflects the updated allocation. Rendering a note across multiple segments
  // produces the “outer section stays first-color, inner section splits”
  // behaviour described by the user.
  interface Segment {
    uniqueId: string;
    noteId: string | number;
    noteNumber: number;
    velocity: number;
    startTime: number;
    endTime: number | null;
    yTop: number;    // 0..1 fraction of viewBoxHeight
    yBottom: number; // 0..1 fraction of viewBoxHeight
    // True when this segment was closed because the same note continues in a
    // fresh segment (allocation change). In that case the next segment abuts
    // this one, so the inner edge must stay solid to avoid a seam. When a note
    // is actually released, hasSuccessor stays false so the fade-into-playhead
    // gradient continues applying and the trailing edge fades out smoothly.
    hasSuccessor: boolean;
  }

  let segments: Segment[] = [];
  let now = performance.now();
  let animationFrameId: number;
  let segmentCounter = 0;
  let prevActiveIds: Set<string | number> = new Set();

  function colorFor(noteNumber: number, map: string[]): string {
    return map[pitchClass(noteNumber)] || '#888';
  }

  // Sort active notes by pitch descending (highest on top) and assign equal
  // vertical slots to each.
  function computeAllocation(
    notes: ActiveNote[]
  ): Map<string | number, { yTop: number; yBottom: number }> {
    const sorted = [...notes].sort((a, b) => b.noteNumber - a.noteNumber);
    const n = sorted.length;
    const result = new Map<string | number, { yTop: number; yBottom: number }>();
    sorted.forEach((note, i) => {
      result.set(note.id, { yTop: i / n, yBottom: (i + 1) / n });
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
      now = ts;
      animationFrameId = requestAnimationFrame(animate);
    };
    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  });

  beforeUpdate(() => {
    const t = performance.now();

    // Detect any change in the active id set (add or remove).
    const currentIds = new Set(activeNotes.keys());
    let setChanged = currentIds.size !== prevActiveIds.size;
    if (!setChanged) {
      for (const id of currentIds) {
        if (!prevActiveIds.has(id)) { setChanged = true; break; }
      }
    }

    if (setChanged) {
      // Reallocate "as of" the last animation frame rather than right now.
      // This lets the closed segments drift by (t - closeAt) worth of pixels
      // before they're rendered, which means the successor segments already
      // have non-zero width on the first frame after reallocation – no
      // one-frame flash of a chained segment suddenly turning solid on top
      // of where a fade used to be. The shift is clamped to one frame's
      // worth of time so a long idle period doesn't introduce a big jump.
      const closeAt = Math.max(now, t - 20);
      reallocate(closeAt);
      prevActiveIds = currentIds;
    }

    // Keep `now` synced to the current time for this render so metrics see
    // the closed segments as already having drifted outward.
    now = t;

    // Drop segments that are fully outside the time window.
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

    // Segments whose note is still active as the innermost piece (no
    // successor) need the inner-edge fade. That covers both the currently-held
    // note at the playhead and notes that have been released but are still
    // drifting out – the fade keeps the trailing edge from being a hard cut.
    // Chained segments (allocation change, same note continues inward) stay
    // solid so adjacent segments abut cleanly.
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
        {@const c = colorFor(seg.noteNumber, $activeColorMap)}
        {#if m.visible && m.fadeInner}
          <linearGradient id={`grad-l-${seg.uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stop-color={c} stop-opacity={m.opacity} />
            <stop offset="70%"  stop-color={c} stop-opacity={m.opacity} />
            <stop offset="100%" stop-color={c} stop-opacity="0" />
          </linearGradient>
          <linearGradient id={`grad-r-${seg.uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stop-color={c} stop-opacity="0" />
            <stop offset="30%"  stop-color={c} stop-opacity={m.opacity} />
            <stop offset="100%" stop-color={c} stop-opacity={m.opacity} />
          </linearGradient>
        {/if}
      {/each}
    </defs>
    <g class="bars-group">
      {#each segments as seg (seg.uniqueId)}
        {@const m = metrics(seg, now)}
        {@const c = colorFor(seg.noteNumber, $activeColorMap)}
        {#if m.visible}
          <rect x={m.leftX}  y={m.y} width={m.width} height={m.height}
                fill={m.fadeInner ? `url(#grad-l-${seg.uniqueId})` : c}
                opacity={m.fadeInner ? 1 : m.opacity}
                shape-rendering="crispEdges" />
          <rect x={m.rightX} y={m.y} width={m.width} height={m.height}
                fill={m.fadeInner ? `url(#grad-r-${seg.uniqueId})` : c}
                opacity={m.fadeInner ? 1 : m.opacity}
                shape-rendering="crispEdges" />
        {/if}
      {/each}
    </g>
    <line x1=0 y1=0 x2=0 y2={viewBoxHeight}
          stroke="rgba(255, 255, 255, 0.5)" stroke-width="1"
          vector-effect="non-scaling-stroke" />
  </svg>
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
</style>

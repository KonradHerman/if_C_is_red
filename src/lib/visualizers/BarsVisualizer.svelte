<script lang="ts">
  import { onMount, beforeUpdate } from 'svelte';
  import { activeColorMap } from '../colorMappings';
  import { noteYPosition, pitchClass } from '../noteGeometry';
  import type { ActiveNote } from '../stores';

  export let activeNotes: Map<string | number, ActiveNote> = new Map();

  const timeWindowMs = 5000;
  const viewBoxTotalWidth = 1000;
  const pixelsPerSecond = viewBoxTotalWidth / (timeWindowMs / 1000);
  const viewBoxHeight = 200;
  const octaveCount = 9;
  const barHeight = viewBoxHeight / octaveCount;

  const geomCfg = { viewBoxWidth: viewBoxTotalWidth, viewBoxHeight, middleOctave: 5, octaveCount };

  interface RenderedBar {
    id: string | number;
    uniqueId: string;
    noteNumber: number;
    velocity: number;
    startTime: number;
    endTime: number | null;
  }

  let renderedBars: RenderedBar[] = [];
  let now = performance.now();
  let animationFrameId: number;
  let prevActiveNotes: Map<string | number, ActiveNote> = new Map();

  function colorFor(noteNumber: number, map: string[]): string {
    return map[pitchClass(noteNumber)] || '#888';
  }

  function barY(noteNumber: number): number {
    return noteYPosition(noteNumber, geomCfg) - barHeight / 2;
  }

  onMount(() => {
    prevActiveNotes = new Map(activeNotes);
    const animate = (ts: number) => {
      now = ts;
      animationFrameId = requestAnimationFrame(animate);
    };
    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  });

  beforeUpdate(() => {
    const updateTime = performance.now();
    const windowEndTime = now + timeWindowMs / 2;
    const filterStartTime = now - timeWindowMs;

    const initialLength = renderedBars.length;
    let barsToKeep = renderedBars.filter((bar) => {
      const endT = bar.endTime ?? Infinity;
      return bar.startTime < windowEndTime && endT > filterStartTime;
    });

    let changed = false;
    const currentIds = new Set(activeNotes.keys());
    const previousIds = new Set(prevActiveNotes.keys());

    let processed = barsToKeep.map((bar) => {
      if (bar.endTime === null && previousIds.has(bar.id) && !currentIds.has(bar.id)) {
        changed = true;
        return { ...bar, endTime: updateTime };
      }
      return bar;
    });

    currentIds.forEach((id) => {
      if (!previousIds.has(id)) {
        const n = activeNotes.get(id);
        if (n) {
          processed.push({
            id: n.id,
            noteNumber: n.noteNumber,
            velocity: n.velocity,
            startTime: updateTime,
            endTime: null,
            uniqueId: `${n.id}-${updateTime}`,
          });
          changed = true;
        }
      }
    });

    prevActiveNotes = new Map(activeNotes);
    if (changed || processed.length !== initialLength) renderedBars = processed;
  });

  function metrics(bar: RenderedBar, t: number) {
    const y = barY(bar.noteNumber);
    const pxPerMs = pixelsPerSecond / 1000;

    let leftX: number, rightX: number, width: number;
    if (bar.endTime === null) {
      const durationMs = Math.max(0, t - bar.startTime);
      const halfWidth = (durationMs * pxPerMs) / 2;
      width = Math.min(halfWidth, viewBoxTotalWidth / 2);
      leftX = -width;
      rightX = 0;
    } else {
      const finalDur = Math.max(0, bar.endTime - bar.startTime);
      const finalHalf = (finalDur * pxPerMs) / 2;
      const sinceEnd = Math.max(0, t - bar.endTime);
      const shift = sinceEnd * (pxPerMs / 2);
      width = Math.min(finalHalf, viewBoxTotalWidth / 2);
      leftX = -(width + shift);
      rightX = shift;
    }

    width = Math.max(0, width);
    const opacity = bar.velocity;

    const vbStart = -viewBoxTotalWidth / 2;
    const vbEnd = viewBoxTotalWidth / 2;
    const leftVisible  = leftX  < vbEnd && leftX  + width > vbStart;
    const rightVisible = rightX < vbEnd && rightX + width > vbStart;
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
        {@const m = metrics(bar, now)}
        {@const c = colorFor(bar.noteNumber, $activeColorMap)}
        {#if m.isVisible}
          <linearGradient id={`grad-fade-in-${bar.uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stop-color={c} stop-opacity="0" />
            <stop offset="5%"   stop-color={c} stop-opacity={m.opacity} />
            <stop offset="90%"  stop-color={c} stop-opacity={m.opacity} />
            <stop offset="100%" stop-color={c} stop-opacity="0" />
          </linearGradient>
          <linearGradient id={`grad-fade-out-${bar.uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stop-color={c} stop-opacity="0" />
            <stop offset="10%"  stop-color={c} stop-opacity={m.opacity} />
            <stop offset="95%"  stop-color={c} stop-opacity={m.opacity} />
            <stop offset="100%" stop-color={c} stop-opacity="0" />
          </linearGradient>
        {/if}
      {/each}
    </defs>
    <g class="bars-group">
      {#each renderedBars as bar (bar.uniqueId)}
        {@const m = metrics(bar, now)}
        {#if m.isVisible}
          <rect x={m.leftX}  y={m.y} width={m.width} height={barHeight}
                fill={`url(#grad-fade-in-${bar.uniqueId})`}  shape-rendering="crispEdges" />
          <rect x={m.rightX} y={m.y} width={m.width} height={barHeight}
                fill={`url(#grad-fade-out-${bar.uniqueId})`} shape-rendering="crispEdges" />
        {/if}
      {/each}
    </g>
    <line x1=0 y1=0 x2=0 y2={viewBoxHeight} stroke="rgba(255, 255, 255, 0.5)" stroke-width="1" />
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

<script lang="ts">
  import { onMount, beforeUpdate } from 'svelte';
  import { activeColorMap } from '../colorMappings';
  import { pitchClass, octave } from '../noteGeometry';
  import type { ActiveNote } from '../stores';

  export let activeNotes: Map<string | number, ActiveNote> = new Map();

  const timeWindowMs = 5000;
  const expansionRate = 200;
  const viewBoxHalf = 600;
  const viewBoxSize = viewBoxHalf * 2;
  const centerFadeRadius = 40;

  // Pitch class picks a 30° sector around the circle; octave shifts the wedge
  // within that sector so different octaves of the same pitch class don't sit
  // at exactly the same angle.
  const OCTAVE_COUNT = 9;
  const MIDDLE_OCTAVE = 4;
  const SECTOR_WIDTH = (2 * Math.PI) / 12;
  const OCTAVE_STEP = SECTOR_WIDTH / OCTAVE_COUNT;

  // Angular width of each wedge – wider than the octave step so wedges have
  // real presence. Adjacent pitch classes are 30° apart so we can comfortably
  // go up to ~15° without running into them.
  const WEDGE_HALF_ANGLE = Math.PI / 30; // 6° → 12° total wedge

  // Rounding applied via a matching stroke on the path. Keeping it modest so
  // the wedges don't bloat noticeably.
  const CORNER_ROUND = 10;

  function angleFor(noteNumber: number): { angleStart: number; angleEnd: number } {
    const pc = pitchClass(noteNumber);
    const oct = octave(noteNumber);
    const sectorCenter = Math.PI / 2 - pc * SECTOR_WIDTH;
    const wedgeCenter = sectorCenter + (oct - MIDDLE_OCTAVE) * OCTAVE_STEP;
    return {
      angleStart: wedgeCenter + WEDGE_HALF_ANGLE,
      angleEnd: wedgeCenter - WEDGE_HALF_ANGLE,
    };
  }

  interface Segment {
    uniqueId: string;
    noteId: string | number;
    noteNumber: number;
    velocity: number;
    startTime: number;
    endTime: number | null;
    angleStart: number;
    angleEnd: number;
  }

  let segments: Segment[] = [];
  let now = performance.now();
  let animationFrameId: number;
  let segmentCounter = 0;
  let prevActiveIds: Set<string | number> = new Set();

  function colorFor(noteNumber: number, map: string[]): string {
    return map[pitchClass(noteNumber)] || '#888';
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
    const eventAt = Math.max(now, t - 20);

    const currentIds = new Set(activeNotes.keys());
    let changed = false;

    for (const id of prevActiveIds) {
      if (!currentIds.has(id)) {
        const seg = segments.find((s) => s.noteId === id && s.endTime === null);
        if (seg) {
          seg.endTime = eventAt;
          changed = true;
        }
      }
    }

    for (const id of currentIds) {
      if (!prevActiveIds.has(id)) {
        const note = activeNotes.get(id);
        if (!note) continue;
        const { angleStart, angleEnd } = angleFor(note.noteNumber);
        segments.push({
          uniqueId: `${id}-${segmentCounter++}`,
          noteId: id,
          noteNumber: note.noteNumber,
          velocity: note.velocity,
          startTime: eventAt,
          endTime: null,
          angleStart,
          angleEnd,
        });
        changed = true;
      }
    }

    prevActiveIds = currentIds;
    now = t;

    const cutoff = t - timeWindowMs;
    const before = segments.length;
    const kept = segments.filter((s) => (s.endTime ?? Infinity) > cutoff);
    if (changed || kept.length !== before) segments = kept;
  });

  function sectorPath(aStart: number, aEnd: number, rInner: number, rOuter: number): string {
    const span = aStart - aEnd;
    const largeArc = span > Math.PI ? 1 : 0;
    const pt = (a: number, r: number): [number, number] => [r * Math.cos(a), -r * Math.sin(a)];
    const [p1x, p1y] = pt(aStart, rOuter);
    const [p2x, p2y] = pt(aEnd, rOuter);
    if (rInner <= 0.01) {
      return `M 0 0 L ${p1x} ${p1y} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2x} ${p2y} Z`;
    }
    const [p3x, p3y] = pt(aEnd, rInner);
    const [p4x, p4y] = pt(aStart, rInner);
    return `M ${p1x} ${p1y} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2x} ${p2y} L ${p3x} ${p3y} A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4x} ${p4y} Z`;
  }

  function metrics(seg: Segment, t: number) {
    const k = expansionRate / 1000;
    const segEnd = seg.endTime ?? t;
    const rInner = Math.max(0, (t - segEnd) * k);
    const rOuter = Math.max(0, (t - seg.startTime) * k);
    const rMax = viewBoxHalf * Math.SQRT2;
    const clampedInner = Math.min(rInner, rMax);
    const clampedOuter = Math.min(rOuter, rMax);
    const width = Math.max(0, clampedOuter - clampedInner);
    const visible = width > 0.1 && seg.velocity > 0.01 && clampedInner < rMax;
    return {
      rInner: clampedInner,
      rOuter: clampedOuter,
      width,
      opacity: seg.velocity,
      visible,
    };
  }
</script>

<div class="radial-visualizer-container">
  <svg
    width="100%"
    height="100%"
    viewBox="{-viewBoxHalf} {-viewBoxHalf} {viewBoxSize} {viewBoxSize}"
    preserveAspectRatio="xMidYMid slice"
  >
    <defs>
      {#each segments as seg (seg.uniqueId)}
        {@const m = metrics(seg, now)}
        {@const c = colorFor(seg.noteNumber, $activeColorMap)}
        {#if m.visible}
          <radialGradient
            id={`grad-${seg.uniqueId}`}
            cx="0" cy="0"
            r={m.rInner + centerFadeRadius}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset={m.rInner / (m.rInner + centerFadeRadius)} stop-color={c} stop-opacity="0" />
            <stop offset="1" stop-color={c} stop-opacity={m.opacity} />
          </radialGradient>
        {/if}
      {/each}
    </defs>
    <g>
      {#each segments as seg (seg.uniqueId)}
        {@const m = metrics(seg, now)}
        {#if m.visible}
          <!-- Primary wedge -->
          <path d={sectorPath(seg.angleStart, seg.angleEnd, m.rInner, m.rOuter)}
                fill={`url(#grad-${seg.uniqueId})`}
                stroke={`url(#grad-${seg.uniqueId})`}
                stroke-width={CORNER_ROUND}
                stroke-linejoin="round"
                stroke-linecap="round" />
          <!-- Mirrored wedge (180° opposite) -->
          <path d={sectorPath(seg.angleStart + Math.PI, seg.angleEnd + Math.PI, m.rInner, m.rOuter)}
                fill={`url(#grad-${seg.uniqueId})`}
                stroke={`url(#grad-${seg.uniqueId})`}
                stroke-width={CORNER_ROUND}
                stroke-linejoin="round"
                stroke-linecap="round" />
        {/if}
      {/each}
    </g>
    <circle cx="0" cy="0" r="3" fill="rgba(255, 255, 255, 0.6)" />
  </svg>
</div>

<style>
  .radial-visualizer-container {
    width: 100vw;
    height: 100vh;
    position: fixed;
    top: 0;
    left: 0;
    overflow: hidden;
  }
  svg { display: block; background-color: transparent; }
</style>

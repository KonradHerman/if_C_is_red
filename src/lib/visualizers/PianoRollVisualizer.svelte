<script lang="ts">
  import { onMount, beforeUpdate } from 'svelte';
  import { activeColorMap } from '../colorMappings';
  import { MIDI_A0, MIDI_C8, pitchClass } from '../noteGeometry';
  import type { ActiveNote } from '../stores';

  export let activeNotes: Map<string | number, ActiveNote> = new Map();

  // Time window shown: the "now" line sits 80% from the right so you can see
  // the attack appear slightly ahead before scrolling into history.
  const windowMs = 6000;
  const nowFrac  = 0.8;
  const lowNote  = MIDI_A0;
  const highNote = MIDI_C8;

  interface Block {
    uid: string;
    id: string | number;
    note: number;
    velocity: number;
    start: number;
    end: number | null;
  }

  let blocks: Block[] = [];
  let now = performance.now();
  let raf: number;
  let prev: Map<string | number, ActiveNote> = new Map();

  const noteRange = highNote - lowNote;

  function isBlackKey(note: number): boolean {
    const pc = pitchClass(note);
    return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
  }

  onMount(() => {
    prev = new Map(activeNotes);
    const loop = (ts: number) => {
      now = ts;
      // Drop blocks that have fully scrolled out.
      const cutoff = ts - windowMs * (1 - nowFrac + 0.1);
      blocks = blocks.filter((b) => (b.end ?? Infinity) > cutoff - windowMs);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });

  beforeUpdate(() => {
    const t = performance.now();
    const cur = new Set(activeNotes.keys());
    const prevIds = new Set(prev.keys());

    blocks = blocks.map((b) => {
      if (b.end === null && prevIds.has(b.id) && !cur.has(b.id)) return { ...b, end: t };
      return b;
    });

    cur.forEach((id) => {
      if (!prevIds.has(id)) {
        const n = activeNotes.get(id);
        if (n) blocks.push({
          uid: `${id}-${t}`,
          id,
          note: n.noteNumber,
          velocity: n.velocity,
          start: t,
          end: null,
        });
      }
    });

    prev = new Map(activeNotes);
  });
</script>

<div class="container">
  <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
    <!-- Faint keyboard rows -->
    {#each Array(noteRange) as _, i}
      {@const note = lowNote + i}
      {@const y = ((highNote - note) / noteRange) * 100}
      <rect
        x="0" y={y} width="100" height={100 / noteRange + 0.1}
        fill={isBlackKey(note) ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.02)'}
      />
    {/each}

    <!-- Octave separator lines at each C -->
    {#each Array(noteRange) as _, i}
      {@const note = lowNote + i}
      {#if pitchClass(note) === 0}
        {@const y = ((highNote - note) / noteRange) * 100}
        <line x1="0" x2="100" y1={y} y2={y} stroke="rgba(255,255,255,0.12)" stroke-width="0.1" />
      {/if}
    {/each}

    <!-- Now line -->
    <line
      x1={nowFrac * 100} x2={nowFrac * 100}
      y1="0" y2="100"
      stroke="rgba(255,255,255,0.4)"
      stroke-width="0.2"
      stroke-dasharray="1 1"
    />

    <!-- Blocks -->
    {#each blocks as b (b.uid)}
      {@const endTime = b.end ?? now}
      {@const startX = nowFrac * 100 - ((now - b.start) / windowMs) * 100}
      {@const endX   = nowFrac * 100 - ((now - endTime) / windowMs) * 100}
      {@const x = Math.max(0, startX)}
      {@const w = Math.max(0.5, Math.min(100, endX) - x)}
      {@const y = ((highNote - b.note) / noteRange) * 100}
      {@const h = 100 / noteRange * 1.15}
      {@const c = $activeColorMap[pitchClass(b.note)] || '#888'}
      {#if x < 100 && x + w > 0}
        <rect
          {x} {y} width={w} height={h}
          fill={c}
          opacity={b.end === null ? 0.4 + b.velocity * 0.6 : 0.25 + b.velocity * 0.4}
          rx="0.3"
        />
      {/if}
    {/each}
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
    background: radial-gradient(ellipse at 50% 50%, #161622 0%, #08080f 100%);
  }
  svg { display: block; width: 100%; height: 100%; }
</style>

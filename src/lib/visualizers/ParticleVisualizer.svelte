<script lang="ts">
  import { onMount, beforeUpdate } from 'svelte';
  import { activeColorMap } from '../colorMappings';
  import { noteXPosition, noteYPosition, pitchClass, prefersReducedMotion } from '../noteGeometry';
  import type { ActiveNote } from '../stores';

  export let activeNotes: Map<string | number, ActiveNote> = new Map();

  const viewBoxWidth = 1200;
  const viewBoxHeight = 800;
  const geomCfg = { viewBoxWidth, viewBoxHeight, middleOctave: 5, octaveCount: 10 };
  const basePerNote = 30;
  const gravity = 0.15;
  const friction = 0.99;
  const particleLifeMs = 2000;

  interface Particle {
    id: string;
    x: number; y: number;
    vx: number; vy: number;
    color: string;
    size: number;
    opacity: number;
    createdAt: number;
    lifeMs: number;
  }

  let particles: Particle[] = [];
  let animationFrameId: number;
  let prevActiveNotes: Map<string | number, ActiveNote> = new Map();
  let particleCounter = 0;
  let reducedMotion = false;

  function colorFor(noteNumber: number, map: string[]): string {
    return map[pitchClass(noteNumber)] || '#888';
  }

  function spawnParticles(note: ActiveNote, palette: string[]) {
    if (reducedMotion) return;
    const cx = noteXPosition(note.noteNumber, geomCfg);
    const cy = noteYPosition(note.noteNumber, geomCfg);
    const color = colorFor(note.noteNumber, palette);
    const count = Math.floor(basePerNote * (0.5 + note.velocity * 0.5));

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 8 * note.velocity;
      particles.push({
        id: `p-${particleCounter++}`,
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        color,
        size: 3 + Math.random() * 4,
        opacity: 0.8 + Math.random() * 0.2,
        createdAt: performance.now(),
        lifeMs: particleLifeMs * (0.7 + Math.random() * 0.6),
      });
    }
  }

  onMount(() => {
    reducedMotion = prefersReducedMotion();
    prevActiveNotes = new Map(activeNotes);

    const animate = (ts: number) => {
      particles = particles
        .map((p) => {
          const age = ts - p.createdAt;
          const lifeRatio = 1 - age / p.lifeMs;
          return {
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vx: p.vx * friction,
            vy: p.vy * friction + gravity,
            opacity: Math.max(0, p.opacity * lifeRatio),
            size: p.size * (0.5 + lifeRatio * 0.5),
          };
        })
        .filter((p) => performance.now() - p.createdAt < p.lifeMs && p.opacity > 0.01);

      animationFrameId = requestAnimationFrame(animate);
    };
    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  });

  beforeUpdate(() => {
    const currentIds = new Set(activeNotes.keys());
    const previousIds = new Set(prevActiveNotes.keys());

    currentIds.forEach((id) => {
      if (!previousIds.has(id)) {
        const n = activeNotes.get(id);
        if (n) spawnParticles(n, $activeColorMap);
      }
    });

    prevActiveNotes = new Map(activeNotes);
  });
</script>

<div class="particle-visualizer-container">
  <svg
    width="100%"
    height="100%"
    viewBox="0 0 {viewBoxWidth} {viewBoxHeight}"
    preserveAspectRatio="xMidYMid meet"
  >
    <g class="note-glows">
      {#each [...activeNotes] as [id, note] (id)}
        {@const cx = noteXPosition(note.noteNumber, geomCfg)}
        {@const cy = noteYPosition(note.noteNumber, geomCfg)}
        {@const c  = colorFor(note.noteNumber, $activeColorMap)}
        <circle {cx} {cy} r={40 + note.velocity * 20} fill={c}
                opacity={note.velocity * 0.4} style="filter: blur(20px);" />
        <circle {cx} {cy} r={15} fill={c} opacity={note.velocity * 0.8} />
      {/each}
    </g>

    <g class="particles">
      {#each particles as p (p.id)}
        <circle cx={p.x} cy={p.y} r={p.size} fill={p.color} opacity={p.opacity} />
      {/each}
    </g>
  </svg>
</div>

<style>
  .particle-visualizer-container {
    width: 100vw;
    height: 100vh;
    position: fixed;
    top: 0;
    left: 0;
    overflow: hidden;
    background: radial-gradient(ellipse at center, #1a1a2e 0%, #0f0f1a 100%);
  }
  svg { display: block; }
  .note-glows circle { transition: opacity 0.1s ease-out; }
</style>

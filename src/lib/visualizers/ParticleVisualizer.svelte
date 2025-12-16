<script lang="ts">
  import { onMount, onDestroy, beforeUpdate } from 'svelte';
  import { noteToColorMap } from '../mappings';
  import type { ActiveNote } from '../../App.svelte';

  // Receive the list of active notes as a prop
  export let activeNotes: Map<string | number, ActiveNote> = new Map();

  // --- Configuration ---
  const viewBoxWidth = 1200;
  const viewBoxHeight = 800;
  const middleOctave = 4;
  const octaveHeight = viewBoxHeight / 8;
  const particlesPerNote = 30;
  const gravity = 0.15;
  const friction = 0.99;
  const particleLifeMs = 2000;

  // --- State ---
  interface Particle {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
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

  // --- Helper Functions ---
  function getNoteColor(noteNumber: number): string {
    return noteToColorMap[noteNumber % 12] || '#888888';
  }

  function getNoteYPosition(noteNumber: number): number {
    const octave = Math.floor(noteNumber / 12) - 1;
    const octaveDiff = octave - middleOctave;
    const middleY = viewBoxHeight / 2;
    return middleY - octaveDiff * octaveHeight;
  }

  function getNoteXPosition(noteNumber: number): number {
    const noteInOctave = noteNumber % 12;
    const spreadFactor = viewBoxWidth / 14;
    return viewBoxWidth / 2 + (noteInOctave - 5.5) * spreadFactor;
  }

  function spawnParticles(note: ActiveNote) {
    const cx = getNoteXPosition(note.noteNumber);
    const cy = getNoteYPosition(note.noteNumber);
    const color = getNoteColor(note.noteNumber);
    const count = Math.floor(particlesPerNote * (0.5 + note.velocity * 0.5));

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 8 * note.velocity;
      
      particles.push({
        id: `p-${particleCounter++}`,
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2, // Slight upward bias
        color,
        size: 3 + Math.random() * 4,
        opacity: 0.8 + Math.random() * 0.2,
        createdAt: performance.now(),
        lifeMs: particleLifeMs * (0.7 + Math.random() * 0.6)
      });
    }
  }

  // --- Lifecycle & Animation ---
  onMount(() => {
    prevActiveNotes = new Map(activeNotes);

    const animate = (timestamp: number) => {
      // Update particle physics
      particles = particles
        .map(p => {
          const age = timestamp - p.createdAt;
          const lifeRatio = 1 - age / p.lifeMs;
          
          return {
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vx: p.vx * friction,
            vy: p.vy * friction + gravity,
            opacity: Math.max(0, p.opacity * lifeRatio),
            size: p.size * (0.5 + lifeRatio * 0.5)
          };
        })
        .filter(p => {
          const age = performance.now() - p.createdAt;
          return age < p.lifeMs && p.opacity > 0.01;
        });

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  });

  // Detect new notes and spawn particles
  beforeUpdate(() => {
    const currentIds = new Set(activeNotes.keys());
    const previousIds = new Set(prevActiveNotes.keys());

    // Spawn particles for newly pressed notes
    currentIds.forEach(id => {
      if (!previousIds.has(id)) {
        const note = activeNotes.get(id);
        if (note) {
          spawnParticles(note);
        }
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
    <!-- Active note glow circles -->
    <g class="note-glows">
      {#each activeNotes as [id, note] (id)}
        {@const cx = getNoteXPosition(note.noteNumber)}
        {@const cy = getNoteYPosition(note.noteNumber)}
        {@const color = getNoteColor(note.noteNumber)}
        <circle
          cx={cx}
          cy={cy}
          r={40 + note.velocity * 20}
          fill={color}
          opacity={note.velocity * 0.4}
          style="filter: blur(20px);"
        />
        <circle
          cx={cx}
          cy={cy}
          r={15}
          fill={color}
          opacity={note.velocity * 0.8}
        />
      {/each}
    </g>

    <!-- Particles -->
    <g class="particles">
      {#each particles as particle (particle.id)}
        <circle
          cx={particle.x}
          cy={particle.y}
          r={particle.size}
          fill={particle.color}
          opacity={particle.opacity}
        />
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

  svg {
    display: block;
  }

  .note-glows circle {
    transition: opacity 0.1s ease-out;
  }
</style>

<script lang="ts">
  import { onMount, beforeUpdate } from 'svelte';
  import { activeColorMap } from '../colorMappings';
  import { pitchClass } from '../noteGeometry';
  import type { ActiveNote } from '../stores';

  export let activeNotes: Map<string | number, ActiveNote> = new Map();

  interface Star {
    id: string;
    note: number;
    x: number;
    y: number;
    r: number;
    color: string;
    born: number;
    life: number;
  }

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let width = 0;
  let height = 0;
  let raf = 0;
  let stars: Star[] = [];
  let prev: Map<string | number, ActiveNote> = new Map();
  let starCounter = 0;

  function resize() {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width  = window.innerWidth;
    height = window.innerHeight;
    canvas.width  = width  * dpr;
    canvas.height = height * dpr;
    canvas.style.width  = width  + 'px';
    canvas.style.height = height + 'px';
    ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }

  function lerpAngle(a: number, b: number): number { return Math.atan2(Math.sin(b - a), Math.cos(b - a)); }

  onMount(() => {
    resize();
    window.addEventListener('resize', resize);

    const loop = () => {
      if (!ctx) return (raf = requestAnimationFrame(loop));

      // Fade trails.
      ctx.fillStyle = 'rgba(5, 5, 14, 0.12)';
      ctx.fillRect(0, 0, width, height);

      const now = performance.now();
      stars = stars.filter((s) => now - s.born < s.life);

      // Draw constellation lines between simultaneously-active stars.
      const recent = stars.filter((s) => now - s.born < 1200);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 0.7;
      for (let i = 0; i < recent.length; i++) {
        for (let j = i + 1; j < recent.length; j++) {
          const a = recent[i], b = recent[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < Math.min(width, height) * 0.35) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Draw stars.
      for (const s of stars) {
        const age = (now - s.born) / s.life;
        const alpha = 1 - age;
        ctx.globalAlpha = alpha;
        // glow
        const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 6);
        grad.addColorStop(0, s.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 6, 0, Math.PI * 2);
        ctx.fill();
        // core
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  });

  beforeUpdate(() => {
    const cur = new Set(activeNotes.keys());
    const prevIds = new Set(prev.keys());
    const palette = $activeColorMap;

    cur.forEach((id) => {
      if (!prevIds.has(id)) {
        const n = activeNotes.get(id);
        if (!n) return;
        // Spawn a star. X leans toward pitch class (spread), Y uses octave.
        const pc = pitchClass(n.noteNumber);
        const octNorm = Math.max(0, Math.min(1, (n.noteNumber - 24) / (96 - 24)));
        const baseX = (pc / 11) * (width * 0.8) + width * 0.1;
        const baseY = (1 - octNorm) * (height * 0.8) + height * 0.1;
        stars.push({
          id: `s-${starCounter++}`,
          note: n.noteNumber,
          x: baseX + (Math.random() - 0.5) * 60,
          y: baseY + (Math.random() - 0.5) * 60,
          r: 1.6 + n.velocity * 2.5,
          color: palette[pc] || '#fff',
          born: performance.now(),
          life: 3500 + Math.random() * 1500,
        });
      }
    });

    prev = new Map(activeNotes);
  });
</script>

<div class="container">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .container {
    width: 100vw;
    height: 100vh;
    position: fixed;
    top: 0;
    left: 0;
    overflow: hidden;
    background: #05050e;
  }
  canvas { display: block; width: 100%; height: 100%; }
</style>

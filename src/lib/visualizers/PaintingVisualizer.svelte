<script lang="ts">
  import { onMount, beforeUpdate } from 'svelte';
  import { activeColorMap } from '../colorMappings';
  import { pitchClass } from '../noteGeometry';
  import type { ActiveNote } from '../stores';

  export let activeNotes: Map<string | number, ActiveNote> = new Map();

  // Each note leaves a lingering brushstroke — the composition builds a painting.
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let width = 0;
  let height = 0;
  let prev: Map<string | number, ActiveNote> = new Map();
  let strokes: { x: number; y: number; r: number; color: string; drift: number; alpha: number }[] = [];
  let raf = 0;

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
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#07070f';
      ctx.fillRect(0, 0, width, height);
    }
  }

  function noteToPos(note: number) {
    // Octave band -> Y, pitch class -> X (with jitter so it doesn't land on a line).
    const pc = pitchClass(note);
    const oct = Math.floor(note / 12);
    const xBase = (pc + 0.5) / 12;
    const yBase = 1 - (oct - 1) / 7;
    const jitterX = (Math.random() - 0.5) * 0.08;
    const jitterY = (Math.random() - 0.5) * 0.08;
    return { x: (xBase + jitterX) * width, y: (yBase + jitterY) * height };
  }

  onMount(() => {
    resize();
    window.addEventListener('resize', resize);
    const loop = () => {
      if (ctx) {
        // Lay down a slow dark fade so strokes mellow out.
        ctx.fillStyle = 'rgba(7,7,15,0.008)';
        ctx.fillRect(0, 0, width, height);

        strokes.forEach((s) => {
          ctx!.beginPath();
          ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx!.fillStyle = s.color;
          ctx!.globalAlpha = s.alpha;
          ctx!.fill();
          ctx!.globalAlpha = 1;
          s.x += s.drift;
          s.r *= 0.995;
          s.alpha *= 0.985;
        });
        strokes = strokes.filter((s) => s.alpha > 0.01 && s.r > 0.5);
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
        const p = noteToPos(n.noteNumber);
        const color = palette[pitchClass(n.noteNumber)] || '#888';
        const count = 4 + Math.floor(n.velocity * 8);
        for (let i = 0; i < count; i++) {
          strokes.push({
            x: p.x + (Math.random() - 0.5) * 40,
            y: p.y + (Math.random() - 0.5) * 40,
            r: 8 + Math.random() * 18 * (0.5 + n.velocity),
            color,
            drift: (Math.random() - 0.5) * 0.4,
            alpha: 0.15 + Math.random() * 0.3,
          });
        }
      }
    });
    prev = new Map(activeNotes);
  });

  function clearCanvas() {
    strokes = [];
    if (ctx) {
      ctx.fillStyle = '#07070f';
      ctx.fillRect(0, 0, width, height);
    }
  }
</script>

<div class="container">
  <canvas bind:this={canvas}></canvas>
  <button class="clear-btn" on:click={clearCanvas} title="Clear canvas">Clear</button>
</div>

<style>
  .container {
    width: 100vw;
    height: 100vh;
    position: fixed;
    top: 0;
    left: 0;
    overflow: hidden;
    background: #07070f;
  }
  canvas { display: block; width: 100%; height: 100%; }
  .clear-btn {
    position: absolute;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    font-family: var(--synth-font-mono, monospace);
    font-size: 10px;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 8px 20px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.15);
    background: rgba(0,0,0,0.4);
    color: rgba(255,255,255,0.6);
    cursor: pointer;
    transition: all 0.2s;
  }
  .clear-btn:hover { color: #fff; border-color: rgba(255,255,255,0.4); }
</style>

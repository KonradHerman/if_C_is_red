<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { activeColorMap } from '../colorMappings';
  import { MIDI_A0, MIDI_C8, pitchClass } from '../noteGeometry';
  import type { ActiveNote } from '../stores';

  export let activeNotes: Map<string | number, ActiveNote> = new Map();

  // Rolling "waterfall" of pitch activity over time. The column nearest the
  // right edge is the freshest. Colors are sourced from the active colormap.

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let raf = 0;
  let width = 0;
  let height = 0;
  let colsWritten = 0;

  const lowNote  = MIDI_A0;
  const highNote = MIDI_C8;
  const noteRange = highNote - lowNote;

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
    colsWritten = 0;
  }

  function drawFrame() {
    if (!ctx) return;

    // Scroll everything left by 1 pixel column.
    const img = ctx.getImageData(1, 0, Math.max(1, width - 1), height);
    ctx.putImageData(img, 0, 0);

    // Clear rightmost column by painting background.
    ctx.fillStyle = '#08080f';
    ctx.fillRect(width - 1, 0, 1, height);

    // Paint current active notes.
    const palette = $activeColorMap;
    activeNotes.forEach((n) => {
      const y = ((highNote - n.noteNumber) / noteRange) * height;
      const h = Math.max(1.5, height / noteRange);
      const c = palette[pitchClass(n.noteNumber)] || '#888';
      ctx!.fillStyle = c;
      ctx!.globalAlpha = 0.4 + n.velocity * 0.6;
      ctx!.fillRect(width - 1, y - h / 2, 1, h);
      ctx!.globalAlpha = 1;
    });

    colsWritten = Math.min(colsWritten + 1, width);
    raf = requestAnimationFrame(drawFrame);
  }

  onMount(() => {
    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(drawFrame);
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  });

  onDestroy(() => cancelAnimationFrame(raf));
</script>

<div class="container">
  <canvas bind:this={canvas}></canvas>
  <!-- Legend overlay -->
  <div class="legend">
    {#each Array(8) as _, i}
      <span class="tick" style="top:{(i / 7) * 100}%">
        {`C${7 - i}`}
      </span>
    {/each}
  </div>
</div>

<style>
  .container {
    width: 100vw;
    height: 100vh;
    position: fixed;
    top: 0;
    left: 0;
    overflow: hidden;
    background: #08080f;
  }
  canvas { display: block; width: 100%; height: 100%; }

  .legend {
    position: absolute;
    top: 0;
    left: 8px;
    height: 100%;
    pointer-events: none;
    font-family: var(--synth-font-mono, monospace);
    font-size: 10px;
    color: rgba(255, 255, 255, 0.35);
  }
  .tick {
    position: absolute;
    transform: translateY(-50%);
  }
</style>

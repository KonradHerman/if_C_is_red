/**
 * Capture the visualizer area as a silent .webm video. Audio is recorded
 * separately via Tone.Recorder (see RecordingControls). For a full A+V
 * bundle, download both and combine in a standard video editor.
 *
 * Works by rasterizing the visualizer element each frame into an offscreen
 * canvas, then using canvas.captureStream() + MediaRecorder. Canvas-based
 * visualizers (Shader, Spectrogram, Painting, Starfield) paint faithfully;
 * SVG-based visualizers (Ball, Bars, Particle, Circular, HarmonicWheel,
 * PianoRoll, Keys) are rasterized via XMLSerializer.
 */

export interface VideoExportOptions {
  durationMs: number;
  fps?: number;
  onProgress?: (pct: number) => void;
}

function isSupported(): boolean {
  return typeof MediaRecorder !== 'undefined'
    && typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

export async function recordVisualizerVideo(
  visualizerEl: HTMLElement,
  opts: VideoExportOptions,
): Promise<Blob | null> {
  if (!isSupported()) return null;

  const fps = opts.fps ?? 24;
  const w = visualizerEl.clientWidth  || window.innerWidth;
  const h = visualizerEl.clientHeight || window.innerHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const stream = (canvas as any).captureStream(fps) as MediaStream;

  let mime = 'video/webm;codecs=vp9';
  if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm;codecs=vp8';
  if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm';

  const chunks: Blob[] = [];
  const rec = new MediaRecorder(stream, { mimeType: mime });
  rec.ondataavailable = (ev) => { if (ev.data.size > 0) chunks.push(ev.data); };

  const startTime = performance.now();
  let timer: number | null = null;

  async function drawFrame() {
    ctx!.fillStyle = '#000';
    ctx!.fillRect(0, 0, w, h);
    const elR = visualizerEl.getBoundingClientRect();

    visualizerEl.querySelectorAll('canvas').forEach((c) => {
      try {
        const r = (c as HTMLCanvasElement).getBoundingClientRect();
        ctx!.drawImage(c as HTMLCanvasElement, r.left - elR.left, r.top - elR.top, r.width, r.height);
      } catch { /* tainted; skip */ }
    });

    const svgs = visualizerEl.querySelectorAll('svg');
    for (const svg of svgs) {
      try {
        const xml = new XMLSerializer().serializeToString(svg);
        const blob = new Blob([xml], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = url; });
        const r = svg.getBoundingClientRect();
        ctx!.drawImage(img, r.left - elR.left, r.top - elR.top, r.width, r.height);
        URL.revokeObjectURL(url);
      } catch { /* best effort */ }
    }

    const elapsed = performance.now() - startTime;
    opts.onProgress?.(Math.min(1, elapsed / opts.durationMs));

    if (elapsed < opts.durationMs) {
      timer = window.setTimeout(drawFrame, 1000 / fps);
    } else {
      rec.stop();
    }
  }

  return new Promise<Blob>((resolve) => {
    rec.onstop = () => {
      if (timer !== null) clearTimeout(timer);
      resolve(new Blob(chunks, { type: mime }));
    };
    rec.start();
    drawFrame();
  });
}

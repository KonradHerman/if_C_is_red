<script lang="ts">
  import { onDestroy } from 'svelte';
  import * as Tone from 'tone';
  import { activeNotes as activeNotesStore } from '../stores';
  import { getChainInput } from '../audioChain';
  import { playUISound } from './UISounds';

  let audioFile: File | null = null;
  let audioPlayer: Tone.Player | null = null;
  let analyser: Tone.Analyser | null = null;
  let isPlaying = false;
  let isAnalyzing = false;
  let dragOver = false;
  let analysisLoop: number | null = null;
  let audioFileUrl: string | null = null;

  function handleFileDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith('audio/')) loadAudioFile(file);
  }

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) loadAudioFile(file);
  }

  async function loadAudioFile(file: File) {
    audioFile = file;
    playUISound('success');

    if (audioPlayer) { audioPlayer.stop(); audioPlayer.dispose(); }
    if (analyser) { analyser.dispose(); analyser = null; }
    if (audioFileUrl) URL.revokeObjectURL(audioFileUrl);
    audioFileUrl = URL.createObjectURL(file);
    analyser = new Tone.Analyser('fft', 2048);

    audioPlayer = new Tone.Player({
      url: audioFileUrl,
      onload: () => console.log('Audio file loaded:', file.name),
      onstop: () => { isPlaying = false; stopAnalysis(); },
    });

    audioPlayer.connect(analyser);
    audioPlayer.connect(getChainInput());
    await Tone.loaded();
  }

  async function togglePlayback() {
    if (!audioPlayer) return;
    await Tone.start();
    if (isPlaying) {
      audioPlayer.stop();
    } else {
      audioPlayer.start();
      isPlaying = true;
      startAnalysis();
    }
    playUISound('switch');
  }

  function startAnalysis() {
    if (!analyser) return;
    isAnalyzing = true;
    const analyze = () => {
      if (!isAnalyzing || !analyser) return;
      const fftData = analyser.getValue() as Float32Array;
      const detected = detectPeaks(fftData);
      activeNotesStore.update((notes) => {
        const out = new Map([...notes].filter(([id]) => !String(id).startsWith('fft-')));
        detected.forEach((noteNum) => {
          out.set(`fft-${noteNum}`, { id: `fft-${noteNum}`, noteNumber: noteNum, velocity: 0.7 });
        });
        return out;
      });
      analysisLoop = requestAnimationFrame(analyze);
    };
    analysisLoop = requestAnimationFrame(analyze);
  }

  function stopAnalysis() {
    isAnalyzing = false;
    if (analysisLoop) { cancelAnimationFrame(analysisLoop); analysisLoop = null; }
    activeNotesStore.update((notes) => new Map([...notes].filter(([id]) => !String(id).startsWith('fft-'))));
  }

  function detectPeaks(fftData: Float32Array, threshold = -60): number[] {
    const peaks: { note: number; amplitude: number }[] = [];
    const sampleRate = Tone.context.sampleRate;
    const binSize = sampleRate / 2048;
    for (let i = 2; i < fftData.length - 2; i++) {
      const val = fftData[i];
      if (val > threshold && val > fftData[i - 1] && val > fftData[i - 2] && val > fftData[i + 1] && val > fftData[i + 2]) {
        const freq = i * binSize;
        if (freq > 20 && freq < 4200) {
          const midiNote = Math.round(12 * Math.log2(freq / 440) + 69);
          if (midiNote >= 21 && midiNote <= 108) peaks.push({ note: midiNote, amplitude: val });
        }
      }
    }
    peaks.sort((a, b) => b.amplitude - a.amplitude);
    const unique = new Set<number>();
    const out: number[] = [];
    for (const p of peaks) {
      if (!unique.has(p.note) && out.length < 12) { unique.add(p.note); out.push(p.note); }
    }
    return out;
  }

  function clearAudioFile() {
    if (audioPlayer) { audioPlayer.stop(); audioPlayer.dispose(); audioPlayer = null; }
    if (analyser) { analyser.dispose(); analyser = null; }
    if (audioFileUrl) { URL.revokeObjectURL(audioFileUrl); audioFileUrl = null; }
    stopAnalysis();
    audioFile = null;
    isPlaying = false;
  }

  onDestroy(() => {
    clearAudioFile();
  });
</script>

<div class="control-group">
  <label class="control-label" for="audio-file-input">Audio Input</label>

  {#if !audioFile}
    <label
      class="file-drop-zone"
      class:drag-over={dragOver}
      for="audio-file-input"
      on:dragover|preventDefault={() => (dragOver = true)}
      on:dragleave={() => (dragOver = false)}
      on:drop={handleFileDrop}
    >
      <input
        id="audio-file-input"
        class="file-input"
        type="file"
        accept="audio/*"
        on:change={handleFileSelect}
      />
      <span class="file-label">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        Drop audio or click
      </span>
    </label>
  {:else}
    <div class="audio-controls">
      <span class="file-name">{audioFile.name.slice(0, 18)}{audioFile.name.length > 18 ? '…' : ''}</span>
      <div class="audio-buttons">
        <button class="play-btn" class:playing={isPlaying} on:click={togglePlayback} aria-label={isPlaying ? 'Stop' : 'Play'}>
          {#if isPlaying}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          {:else}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          {/if}
        </button>
        <button class="clear-btn" on:click={clearAudioFile} aria-label="Remove file">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  {/if}

  {#if isAnalyzing}
    <div class="analyzing-indicator">
      <div class="analyzing-dot"></div>
      <span>Analyzing…</span>
    </div>
  {/if}
</div>

<style>
  .control-group { margin-bottom: 12px; }
  .control-label {
    display: block;
    font-family: var(--synth-font-mono, monospace);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--synth-label, #6b6b78);
    margin-bottom: 6px;
  }

  .file-drop-zone {
    display: block;
    position: relative;
    border: 2px dashed var(--synth-border-light, rgba(255,255,255,0.15));
    border-radius: var(--synth-radius-md, 8px);
    padding: 16px;
    text-align: center;
    transition: all 0.2s ease;
    background: rgba(0,0,0,0.2);
    cursor: pointer;
  }
  .file-drop-zone:hover, .file-drop-zone.drag-over {
    border-color: var(--synth-accent, #ff6b6b);
    background: rgba(255, 107, 107, 0.05);
  }
  .file-input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .file-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--synth-label, #888);
    font-size: 11px;
    pointer-events: none;
  }
  .file-label svg { opacity: 0.6; }

  .audio-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(0,0,0,0.3);
    border-radius: var(--synth-radius-sm, 8px);
    padding: 8px 12px;
  }
  .file-name {
    font-family: var(--synth-font-mono, monospace);
    font-size: 11px;
    color: var(--synth-text-dim, #aaa);
  }
  .audio-buttons { display: flex; gap: 6px; }
  .play-btn, .clear-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }
  .play-btn {
    background: var(--synth-accent, #ff6b6b);
    color: #fff;
  }
  .play-btn:hover { filter: brightness(1.1); box-shadow: 0 0 12px rgba(255,107,107,0.5); }
  .play-btn.playing { background: var(--synth-accent-yellow, #facc15); }

  .clear-btn {
    background: rgba(255,255,255,0.1);
    color: var(--synth-label, #888);
  }
  .clear-btn:hover { background: rgba(239, 68, 68, 0.3); color: #ef4444; }

  .analyzing-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    font-size: 10px;
    color: var(--synth-accent, #ff6b6b);
  }
  .analyzing-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--synth-accent, #ff6b6b);
    animation: pulse 1s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .analyzing-dot { animation: none; }
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.4; }
  }
</style>

<script lang="ts">
  import { onDestroy } from 'svelte';
  import * as Tone from 'tone';
  import { activeNotes as activeNotesStore } from '../stores';
  import { getChainInput } from '../audioChain';
  import { detectNotes, resetDetector } from '../pitchDetect';
  import { transcribeFile, type TranscribedNote } from '../transcribe';
  import { playUISound } from './UISounds';

  let audioFile: File | null = null;
  let audioPlayer: Tone.Player | null = null;
  let analyser: Tone.Analyser | null = null;
  let isPlaying = false;
  let isAnalyzing = false;
  let dragOver = false;
  let analysisLoop: number | null = null;
  let audioFileUrl: string | null = null;

  // Transcription state. When a file transcribes successfully its notes drive
  // the visualizers directly; the live FFT analyser is only used if that fails.
  let transcript: TranscribedNote[] | null = null;
  let transcribing = false;
  let transcribeProgress = 0;
  let transcribeFailed = false;
  let playbackStartedAt = 0;

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
    // 4096 bins (fftSize 8192) is the sweet spot measured against ground
    // truth: enough resolution for the harmonic matching to separate low
    // notes, at a 171ms window rather than the 341ms a larger FFT would cost.
    // Smoothing is well below Tone's 0.8 default, which at 60fps smears note
    // onsets and holds energy after note-off (read as phantom sustain).
    analyser = new Tone.Analyser('fft', 4096);
    analyser.smoothing = 0.4;

    audioPlayer = new Tone.Player({
      url: audioFileUrl,
      onload: () => console.log('Audio file loaded:', file.name),
      onstop: () => { isPlaying = false; stopAnalysis(); },
    });

    audioPlayer.connect(analyser);
    audioPlayer.connect(getChainInput());
    await Tone.loaded();

    transcript = null;
    transcribeFailed = false;
    transcribing = true;
    transcribeProgress = 0;
    try {
      transcript = await transcribeFile(file, (p) => { transcribeProgress = p; });
      playUISound('success');
    } catch (e) {
      console.warn('Transcription unavailable; falling back to live analysis.', e);
      transcribeFailed = true;
      transcript = null;
    } finally {
      transcribing = false;
    }
  }

  async function togglePlayback() {
    if (!audioPlayer || transcribing) return;
    await Tone.start();
    if (isPlaying) {
      audioPlayer.stop();
    } else {
      audioPlayer.start();
      isPlaying = true;
      if (transcript) startTranscriptPlayback();
      else startAnalysis();
    }
    playUISound('switch');
  }

  // ------------------------------------------------------------
  // Transcript playback: each frame, show exactly the notes whose
  // [start, start+duration) span covers the current playback position.
  // Sampling elapsed time per frame (rather than scheduling timeouts) keeps
  // the visuals aligned even if a frame is late or the tab is throttled.
  // ------------------------------------------------------------
  function startTranscriptPlayback() {
    if (!transcript) return;
    playbackStartedAt = performance.now();
    isAnalyzing = true;
    const tick = () => {
      if (!isAnalyzing || !transcript) return;
      const t = (performance.now() - playbackStartedAt) / 1000;
      activeNotesStore.update((notes) => {
        const out = new Map([...notes].filter(([id]) => !String(id).startsWith('fft-')));
        for (let i = 0; i < transcript!.length; i++) {
          const n = transcript![i];
          if (n.start > t) break;                 // sorted by start
          if (t < n.start + n.duration) {
            const id = `fft-${i}`;
            out.set(id, { id, noteNumber: n.note, velocity: n.velocity });
          }
        }
        return out;
      });
      analysisLoop = requestAnimationFrame(tick);
    };
    analysisLoop = requestAnimationFrame(tick);
  }

  // ------------------------------------------------------------
  // Note tracking with attack/release hysteresis. Raw per-frame FFT
  // peaks flicker constantly (one frame above threshold = one spurious
  // "note"), so a peak must persist for ATTACK_MS before it becomes a
  // visible note, and a note survives RELEASE_MS of absence before it
  // is dropped. This is what keeps piano recordings from spraying
  // dozens of one-frame notes over the real ones.
  // ------------------------------------------------------------
  const ATTACK_MS = 60;
  const RELEASE_MS = 150;

  // Re-articulation. A note struck again while it is still ringing never
  // leaves the detector's output, so tracking presence alone merges the
  // repeats into one long note. A fresh strike does show up as a sharp jump
  // in that note's own harmonic energy, so a rise well above the track's
  // decaying level is treated as a new note: the id changes, which the
  // visualizers read as note-off followed by note-on.
  // Judged on harmonic flux rather than velocity: a re-strike lands at roughly
  // the same velocity as the note it replaces (velocity is compressed and
  // clamped), but it is unmistakable as a jump in energy.
  // Measured against synthetic repeats: sustain flux peaks around 0.001 while
  // a re-strike lands near 0.24, so anything in 0.10-0.20 separates them.
  const RETRIGGER_ONSET = 0.15;  // flux above which a rise counts as a new strike
  const RETRIGGER_GAP_MS = 90;   // debounce, so one attack fires once

  interface FftTrack {
    firstSeen: number;
    lastSeen: number;
    velocity: number;
    live: boolean;
    lastStrike: number;
    seq: number;         // bumped per strike so the note gets a new identity
  }
  const fftTracks = new Map<number, FftTrack>();

  function startAnalysis() {
    if (!analyser) return;
    isAnalyzing = true;
    resetDetector();
    const analyze = () => {
      if (!isAnalyzing || !analyser) return;
      const fftData = analyser.getValue() as Float32Array;
      const now = performance.now();
      const detected = detectNotes(fftData, { sampleRate: Tone.context.sampleRate });

      const seen = new Set<number>();
      detected.forEach(({ note, velocity, onset }) => {
        seen.add(note);
        const t = fftTracks.get(note);
        if (!t) {
          fftTracks.set(note, {
            firstSeen: now, lastSeen: now, velocity, live: false,
            lastStrike: now, seq: 0,
          });
        } else {
          t.lastSeen = now;
          if (t.live && onset > RETRIGGER_ONSET && now - t.lastStrike > RETRIGGER_GAP_MS) {
            t.seq++;
            t.lastStrike = now;
            t.velocity = velocity;
          } else {
            t.velocity = t.velocity * 0.7 + velocity * 0.3;
          }
          if (!t.live && now - t.firstSeen >= ATTACK_MS) t.live = true;
        }
      });
      fftTracks.forEach((t, note) => {
        if (!seen.has(note) && now - t.lastSeen > RELEASE_MS) fftTracks.delete(note);
      });

      activeNotesStore.update((notes) => {
        const out = new Map([...notes].filter(([id]) => !String(id).startsWith('fft-')));
        fftTracks.forEach((t, note) => {
          if (!t.live) return;
          const id = `fft-${note}-${t.seq}`;
          out.set(id, { id, noteNumber: note, velocity: t.velocity });
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
    fftTracks.clear();
    activeNotesStore.update((notes) => new Map([...notes].filter(([id]) => !String(id).startsWith('fft-'))));
  }


  function clearAudioFile() {
    if (audioPlayer) { audioPlayer.stop(); audioPlayer.dispose(); audioPlayer = null; }
    if (analyser) { analyser.dispose(); analyser = null; }
    if (audioFileUrl) { URL.revokeObjectURL(audioFileUrl); audioFileUrl = null; }
    stopAnalysis();
    audioFile = null;
    isPlaying = false;
    transcript = null;
    transcribing = false;
    transcribeFailed = false;
    transcribeProgress = 0;
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
        <button class="play-btn" class:playing={isPlaying} on:click={togglePlayback} disabled={transcribing} aria-label={isPlaying ? 'Stop' : 'Play'}>
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

  {#if transcribing}
    <div class="transcribe-status">
      <div class="progress-track">
        <div class="progress-fill" style="width: {Math.round(transcribeProgress * 100)}%"></div>
      </div>
      <span class="progress-label">Finding notes… {Math.round(transcribeProgress * 100)}%</span>
    </div>
  {:else if transcript}
    <div class="transcribe-status done">
      <span class="progress-label">{transcript.length} notes found</span>
    </div>
  {:else if transcribeFailed}
    <div class="transcribe-status warn">
      <span class="progress-label">Live analysis (transcription unavailable)</span>
    </div>
  {/if}

  {#if isAnalyzing && !transcript}
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

  .transcribe-status {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .progress-track {
    height: 3px;
    border-radius: 2px;
    background: var(--synth-bg, #1a1a24);
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: var(--synth-accent, #ff6b6b);
    transition: width 0.15s linear;
  }
  .progress-label {
    font-family: var(--synth-font-mono, monospace);
    font-size: 9px;
    letter-spacing: 0.5px;
    color: var(--synth-label, #6b6b78);
  }
  .transcribe-status.done .progress-label { color: var(--synth-accent-green, #4ade80); }
  .transcribe-status.warn .progress-label { color: var(--synth-accent-yellow, #facc15); }

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

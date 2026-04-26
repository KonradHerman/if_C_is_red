<script lang="ts">
  import { onDestroy } from 'svelte';
  import * as Tone from 'tone';
  import { isAudioReady } from './stores';
  import {
    recordedSeq,
    startRecording as seqStart,
    stopRecording as seqStop,
    playSequence,
    stopPlayback,
    isPlaying as isSeqPlaying,
    clearRecording,
  } from './sequencer';
  import { copyShareUrl } from './shareLink';
  import { getChainOutput } from './audioChain';

  // Audio recording state (via Tone.Recorder).
  let recorder: Tone.Recorder | null = null;
  let isAudioRecording = false;
  let audioBlob: Blob | null = null;
  let downloadUrl: string | null = null;
  let durationSec = 0;
  let durationTimer: number | null = null;
  let copied = false;
  let copyTimer: number | null = null;

  // Intentionally do NOT create Tone.Recorder at mount. Constructing a
  // MediaStreamAudioDestinationNode before a user gesture triggers Firefox's
  // autoplay guard and can leave the node in a broken state. Lazy-create on
  // first record click, after the AudioContext has been resumed.
  function ensureRecorder() {
    if (recorder) return recorder;
    recorder = new Tone.Recorder();
    getChainOutput().connect(recorder);
    return recorder;
  }

  function formatTime(s: number): string {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
  }

  async function startAudio() {
    if (!$isAudioReady) return;
    const rec = ensureRecorder();
    if (downloadUrl) { URL.revokeObjectURL(downloadUrl); downloadUrl = null; }
    audioBlob = null;
    await rec.start();
    seqStart();
    isAudioRecording = true;
    durationSec = 0;
    durationTimer = window.setInterval(() => durationSec++, 1000);
  }

  async function stopAudio() {
    if (!recorder || !isAudioRecording) return;
    if (durationTimer) { clearInterval(durationTimer); durationTimer = null; }
    audioBlob = await recorder.stop();
    seqStop();
    isAudioRecording = false;
    downloadUrl = URL.createObjectURL(audioBlob);
  }

  function downloadAudio() {
    if (!downloadUrl || !audioBlob) return;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `if-c-is-red-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function resetRec() {
    audioBlob = null;
    downloadUrl = null;
    durationSec = 0;
    clearRecording();
  }

  async function copyShare() {
    const ok = await copyShareUrl($recordedSeq);
    copied = ok;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = window.setTimeout(() => (copied = false), 2000);
  }

  async function replay() {
    await playSequence($recordedSeq);
  }

  function stopReplay() { stopPlayback(); }

  onDestroy(() => {
    if (durationTimer) clearInterval(durationTimer);
    if (copyTimer) clearTimeout(copyTimer);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    recorder?.dispose();
  });
</script>

<div class="recording-controls" role="toolbar" aria-label="Recording">
  {#if isAudioRecording}
    <div class="recording-indicator">
      <span class="recording-dot"></span>
      <span class="recording-time">{formatTime(durationSec)}</span>
    </div>
    <button class="stop-btn" on:click={stopAudio} aria-label="Stop recording"><span class="stop-icon"></span></button>
  {:else if audioBlob || $recordedSeq}
    <div class="recording-complete">
      {#if audioBlob}
        <span class="complete-time">{formatTime(durationSec)}</span>
      {:else}
        <span class="complete-time shared" title="A shared song was loaded from the URL">Shared</span>
      {/if}
      {#if $recordedSeq}
        <button class="icon-btn replay" on:click={$isSeqPlaying ? stopReplay : replay} aria-label="Replay sequence" title={$isSeqPlaying ? 'Stop playback' : 'Replay through visualizer'}>
          {#if $isSeqPlaying}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          {:else}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          {/if}
        </button>
      {/if}
      {#if audioBlob}
        <button class="icon-btn download" on:click={downloadAudio} aria-label="Download audio" title="Download audio">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
      {/if}
      <button class="icon-btn share" class:copied on:click={copyShare} aria-label="Copy share link" title="Copy share link">
        {#if copied}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        {:else}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/></svg>
        {/if}
      </button>
      <button class="icon-btn new-btn" on:click={resetRec} aria-label="Clear" title="Clear">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  {:else}
    <button
      class="record-btn"
      on:click={startAudio}
      disabled={!$isAudioReady}
      aria-label="Start recording"
      title={$isAudioReady ? 'Start recording' : 'Play a note first'}
    >
      <span class="record-icon"></span>
    </button>
  {/if}
</div>

<style>
  .recording-controls {
    position: fixed;
    bottom: 20px;
    right: 20px;
    display: flex;
    align-items: center;
    gap: 10px;
    z-index: 100;
    background: var(--synth-panel-dark, rgba(30, 30, 40, 0.9));
    padding: 10px 15px;
    border-radius: 30px;
    border: 1px solid var(--synth-border, rgba(255,255,255,0.1));
    backdrop-filter: blur(10px);
    box-shadow: var(--synth-shadow, 0 4px 12px rgba(0,0,0,0.5));
  }
  .record-btn {
    width: 44px; height: 44px;
    border-radius: 50%;
    border: 2px solid var(--synth-accent, #ff4444);
    background: transparent;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.2s ease;
  }
  .record-btn:hover:not(:disabled) {
    background: rgba(255,68,68,0.2);
    box-shadow: 0 0 10px rgba(255,68,68,0.5);
    transform: scale(1.05);
  }
  .record-btn:disabled { opacity: 0.4; cursor: not-allowed; border-color: #666; }
  .record-icon {
    width: 20px; height: 20px; background: var(--synth-accent, #ff4444); border-radius: 50%;
  }
  .record-btn:disabled .record-icon { background: #666; }

  .recording-indicator { display: flex; align-items: center; gap: 8px; color: #fff; font-family: var(--synth-font-mono, monospace); }
  .recording-dot { width: 12px; height: 12px; background: #ff4444; border-radius: 50%; box-shadow: 0 0 8px #ff4444; animation: pulse 1s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) { .recording-dot { animation: none; } }
  @keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.9); } }
  .recording-time, .complete-time { font-size: 14px; min-width: 45px; color: #fff; }
  .complete-time.shared {
    font-size: 10px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--synth-accent-purple, #a78bfa);
    padding: 3px 8px;
    border: 1px solid var(--synth-accent-purple, #a78bfa);
    border-radius: 999px;
    min-width: 0;
  }

  .stop-btn {
    width: 44px; height: 44px; border-radius: 50%;
    border: 2px solid #fff; background: transparent; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.2s ease;
  }
  .stop-btn:hover { background: rgba(255,255,255,0.2); transform: scale(1.05); }
  .stop-icon { width: 16px; height: 16px; background: #fff; border-radius: 2px; }

  .recording-complete { display: flex; align-items: center; gap: 8px; color: #fff; font-family: var(--synth-font-mono, monospace); }
  .icon-btn {
    width: 32px; height: 32px; border-radius: 50%;
    border: none; background: rgba(255,255,255,0.12); color: #fff;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: all 0.15s ease;
  }
  .icon-btn:hover { transform: scale(1.1); }
  .icon-btn.replay:hover  { background: rgba(96,165,250,0.4); box-shadow: 0 0 8px rgba(96,165,250,0.4); }
  .icon-btn.download:hover{ background: rgba(74,222,128,0.4); box-shadow: 0 0 8px rgba(74,222,128,0.4); }
  .icon-btn.share:hover   { background: rgba(168,139,250,0.4); box-shadow: 0 0 8px rgba(168,139,250,0.4); }
  .icon-btn.share.copied  { background: rgba(74,222,128,0.6); color: #fff; }
  .icon-btn.new-btn:hover { background: rgba(239,68,68,0.4); }
</style>

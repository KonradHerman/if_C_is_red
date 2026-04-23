<script lang="ts">
  import { demoSongs } from '../demoSongs';
  import { playSequence, stopPlayback, isPlaying } from '../sequencer';
  import { playUISound } from './UISounds';

  let playingId: string | null = null;

  $: if (!$isPlaying) playingId = null;

  async function play(id: string) {
    const song = demoSongs.find((s) => s.id === id);
    if (!song) return;
    playUISound('click');
    playingId = id;
    await playSequence(song.sequence);
  }

  function stop() {
    stopPlayback();
    playingId = null;
  }
</script>

<div class="control-group">
  <h4 class="control-label">Demo Songs</h4>
  <ul class="list">
    {#each demoSongs as song (song.id)}
      <li>
        <button
          class="demo-btn"
          class:playing={playingId === song.id}
          on:click={() => (playingId === song.id ? stop() : play(song.id))}
        >
          {#if playingId === song.id}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          {:else}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          {/if}
          <span class="title">{song.title}</span>
          <span class="composer">{song.composer}</span>
        </button>
      </li>
    {/each}
  </ul>
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
    margin: 0 0 6px;
  }
  .list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 3px; }
  .demo-btn {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: var(--synth-bg, #1a1a24);
    border: 1px solid var(--synth-border-light, rgba(255,255,255,0.08));
    border-radius: var(--synth-radius-sm, 6px);
    color: var(--synth-text, #e0e0e8);
    cursor: pointer;
    transition: all 0.15s;
    text-align: left;
  }
  .demo-btn:hover {
    background: var(--synth-panel, #252532);
    border-color: var(--synth-accent, #ff6b6b);
  }
  .demo-btn.playing {
    background: rgba(255, 107, 107, 0.12);
    border-color: var(--synth-accent, #ff6b6b);
    color: var(--synth-accent, #ff6b6b);
  }
  .demo-btn svg { flex-shrink: 0; color: var(--synth-accent, #ff6b6b); }
  .title {
    font-family: var(--synth-font-mono, monospace);
    font-size: 10px;
    font-weight: 600;
    flex: 1;
  }
  .composer {
    font-family: var(--synth-font-mono, monospace);
    font-size: 9px;
    color: var(--synth-text-dim, #888);
  }
</style>

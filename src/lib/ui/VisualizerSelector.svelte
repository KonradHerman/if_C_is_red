<script lang="ts">
  import { selectedVisualizerName, visualizerOptions } from '../stores';
  import { playUISound } from './UISounds';

  function pick(name: string) {
    selectedVisualizerName.set(name);
    playUISound('click');
  }
</script>

<div class="control-group">
  <h4 class="control-label">Visualizer</h4>
  <div class="grid">
    {#each visualizerOptions as option (option.name)}
      <button
        class="viz-chip"
        class:active={$selectedVisualizerName === option.name}
        on:click={() => pick(option.name)}
        title={option.description}
      >
        {option.label}
      </button>
    {/each}
  </div>
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
  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 4px;
  }
  .viz-chip {
    font-family: var(--synth-font-mono, monospace);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: var(--synth-text, #e0e0e8);
    background: var(--synth-bg, #1a1a24);
    border: 1px solid var(--synth-border-light, rgba(255,255,255,0.1));
    border-radius: var(--synth-radius-sm, 6px);
    padding: 7px 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
  }
  .viz-chip:hover {
    background: var(--synth-panel, #252532);
    border-color: var(--synth-accent, #ff6b6b);
    color: #fff;
  }
  .viz-chip.active {
    background: var(--synth-accent, #ff6b6b);
    color: #fff;
    border-color: var(--synth-accent, #ff6b6b);
    box-shadow: 0 0 10px rgba(255,107,107,0.3);
  }
</style>

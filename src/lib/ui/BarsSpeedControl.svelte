<script lang="ts">
  import { barsSpeed } from '../stores';

  const MIN = 0.25;
  const MAX = 4;

  function reset() {
    barsSpeed.set(1);
  }
</script>

<div class="control-group">
  <div class="row">
    <label class="control-label" for="bars-speed">Bar Speed</label>
    <button class="value" on:click={reset} title="Reset to 1.0x">{$barsSpeed.toFixed(2)}x</button>
  </div>
  <input
    id="bars-speed"
    class="slider"
    type="range"
    min={MIN}
    max={MAX}
    step="0.05"
    bind:value={$barsSpeed}
    aria-label="Bar scroll speed"
  />
</div>

<style>
  .control-group { margin-bottom: 12px; }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }
  .control-label {
    font-family: var(--synth-font-mono, monospace);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--synth-label, #6b6b78);
  }
  .value {
    font-family: var(--synth-font-mono, monospace);
    font-size: 10px;
    font-weight: 600;
    color: var(--synth-accent, #ff6b6b);
    background: var(--synth-bg, #1a1a24);
    border: 1px solid transparent;
    border-radius: 4px;
    padding: 2px 6px;
    cursor: pointer;
  }
  .value:hover { border-color: var(--synth-accent, #ff6b6b); }

  .slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 4px;
    border-radius: 2px;
    background: var(--synth-bg, #1a1a24);
    border: 1px solid var(--synth-border-light, rgba(255,255,255,0.1));
    outline: none;
    cursor: pointer;
    margin: 0;
  }
  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--synth-accent, #ff6b6b);
    border: none;
    cursor: pointer;
    box-shadow: 0 0 6px rgba(255,107,107,0.5);
  }
  .slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--synth-accent, #ff6b6b);
    border: none;
    cursor: pointer;
  }
</style>

<script lang="ts">
  import { selectedInstrumentName, instrumentOptions } from '../stores';
  import { playUISound } from './UISounds';

  function handleChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    selectedInstrumentName.set(target.value);
    playUISound('click');
  }
</script>

<div class="control-group">
  <label class="control-label" for="instrument-select">Instrument</label>
  <select
    id="instrument-select"
    class="synth-select"
    value={$selectedInstrumentName}
    on:change={handleChange}
  >
    {#each ['Synth', 'Sampler'] as category}
      <optgroup label={category}>
        {#each instrumentOptions.filter((o) => o.category === category) as option (option.name)}
          <option value={option.name}>{option.name}</option>
        {/each}
      </optgroup>
    {/each}
  </select>
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
  .synth-select {
    width: 100%;
    font-family: var(--synth-font-mono, monospace);
    font-size: 12px;
    color: var(--synth-text, #e0e0e8);
    background: var(--synth-bg, #1a1a24);
    border: 1px solid var(--synth-border-light, rgba(255,255,255,0.12));
    border-radius: var(--synth-radius-sm, 6px);
    padding: 8px 32px 8px 12px;
    cursor: pointer;
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.4);
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    transition: all 0.15s ease;
  }
  .synth-select:hover  { border-color: var(--synth-accent, #ff6b6b); }
  .synth-select:focus  {
    outline: none;
    border-color: var(--synth-accent, #ff6b6b);
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.4), 0 0 0 2px rgba(255,107,107,0.2);
  }
</style>

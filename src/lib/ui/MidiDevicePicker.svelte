<script lang="ts">
  import { midiInputs, midiStatus, selectedMidiInputId } from '../stores';
</script>

<div class="control-group">
  <label class="control-label" for="midi-input-select">MIDI Device</label>
  {#if $midiStatus === 'unsupported'}
    <div class="status unsupported">Not supported by this browser</div>
  {:else if $midiStatus === 'unavailable'}
    <div class="status unavailable">
      <span class="dot"></span> No MIDI access
    </div>
  {:else}
    <select
      id="midi-input-select"
      class="synth-select"
      value={$selectedMidiInputId}
      on:change={(e) => selectedMidiInputId.set((e.target as HTMLSelectElement).value)}
    >
      <option value="all">All devices ({$midiInputs.length})</option>
      {#each $midiInputs as input (input.id)}
        <option value={input.id}>{input.name}</option>
      {/each}
    </select>
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
  }
  .status {
    font-family: var(--synth-font-mono, monospace);
    font-size: 10px;
    color: var(--synth-text-dim, #888);
    padding: 6px 10px;
    border: 1px dashed var(--synth-border-light, rgba(255,255,255,0.12));
    border-radius: var(--synth-radius-sm, 6px);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .status .dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #555;
  }
</style>

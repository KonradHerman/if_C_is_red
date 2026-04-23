<script lang="ts">
  import SynthKnob from './SynthKnob.svelte';
  import SynthToggle from './SynthToggle.svelte';
  import {
    masterVolume, reverbAmount, delayAmount, chorusAmount, masterMuted,
  } from '../stores';

  function onVolume(e: CustomEvent<{ value: number }>)  { masterVolume.set(e.detail.value); }
  function onReverb(e: CustomEvent<{ value: number }>)  { reverbAmount.set(e.detail.value); }
  function onDelay(e: CustomEvent<{ value: number }>)   { delayAmount.set(e.detail.value); }
  function onChorus(e: CustomEvent<{ value: number }>)  { chorusAmount.set(e.detail.value); }
  function onMute(e: CustomEvent<{ checked: boolean }>) { masterMuted.set(e.detail.checked); }
</script>

<div class="control-group">
  <h4 class="control-label">Mixer</h4>

  <div class="knobs">
    <SynthKnob
      value={$masterVolume}
      min={0} max={100} step={1}
      label="Vol"
      size={48}
      color="var(--synth-accent-green)"
      on:change={onVolume}
    />
    <SynthKnob
      value={$reverbAmount}
      min={0} max={100} step={1}
      label="Verb"
      size={48}
      color="var(--synth-accent-blue)"
      on:change={onReverb}
    />
    <SynthKnob
      value={$delayAmount}
      min={0} max={100} step={1}
      label="Delay"
      size={48}
      color="var(--synth-accent-purple)"
      on:change={onDelay}
    />
    <SynthKnob
      value={$chorusAmount}
      min={0} max={100} step={1}
      label="Chorus"
      size={48}
      color="var(--synth-accent-yellow)"
      on:change={onChorus}
    />
  </div>

  <div class="mute-row">
    <SynthToggle
      checked={$masterMuted}
      label="Mute"
      color="red"
      on:change={onMute}
    />
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
    margin: 0 0 8px;
  }
  .knobs {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    margin-bottom: 8px;
  }
  .mute-row {
    display: flex;
    justify-content: flex-end;
    padding-top: 6px;
    border-top: 1px solid var(--synth-border, rgba(255,255,255,0.06));
  }
</style>

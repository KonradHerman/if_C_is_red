<script lang="ts">
  import {
    isAudioReady,
    isLoadingSynth,
    selectedInstrumentName,
    midiStatus,
    midiInputs,
    selectedMidiInputId,
    keyboardOctaveOffset,
    currentChord,
  } from '../stores';

  $: midiLabel = (() => {
    if ($midiStatus === 'unsupported') return 'NO MIDI';
    if ($midiStatus === 'unavailable') return 'NO MIDI';
    if ($midiInputs.length === 0)       return 'MIDI IDLE';
    if ($selectedMidiInputId === 'all') return `MIDI · ALL`;
    const dev = $midiInputs.find((i) => i.id === $selectedMidiInputId);
    return dev ? `MIDI · ${dev.name}` : `MIDI · ALL`;
  })();
</script>

<div class="status-strip">
  <div class="row">
    <span class="chip status" class:ready={$isAudioReady} class:loading={$isLoadingSynth}>
      <span class="led" class:on={$isAudioReady} class:pulse={$isLoadingSynth}></span>
      {#if $isLoadingSynth}
        Loading {$selectedInstrumentName}…
      {:else if $isAudioReady}
        Ready
      {:else}
        Tap a key to start
      {/if}
    </span>

    <span class="chip sub">{midiLabel}</span>
    <span class="chip sub">Oct {$keyboardOctaveOffset >= 0 ? '+' : ''}{$keyboardOctaveOffset}</span>
  </div>

  <div class="chord-row">
    <span class="chip chord" class:empty={!$currentChord}>
      {$currentChord ? $currentChord.label : '—'}
    </span>
  </div>
</div>

<style>
  .status-strip {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 12px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .chord-row {
    display: flex;
    justify-content: flex-start;
    min-height: 22px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: var(--synth-font-mono, monospace);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    padding: 4px 8px;
    border-radius: 999px;
    background: rgba(0,0,0,0.3);
    color: var(--synth-text-dim, #8a8a95);
    border: 1px solid var(--synth-border, rgba(255,255,255,0.05));
  }
  .chip.status.ready { color: var(--synth-accent-green, #4ade80); }
  .chip.status.loading { color: var(--synth-accent-yellow, #facc15); }
  .chip.chord {
    background: var(--synth-accent, #ff6b6b);
    color: #fff;
    border-color: var(--synth-accent, #ff6b6b);
    font-size: 11px;
    letter-spacing: 1.5px;
    padding: 4px 12px;
    min-width: 48px;
    justify-content: center;
    transition: opacity 0.15s ease-out, background 0.15s ease-out;
  }
  .chip.chord.empty {
    background: transparent;
    color: var(--synth-label, #6b6b78);
    border-color: var(--synth-border, rgba(255,255,255,0.08));
    opacity: 0.55;
  }
  .led {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #333;
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.5);
  }
  .led.on {
    background: var(--synth-accent-green, #4ade80);
    box-shadow: 0 0 6px var(--synth-accent-green, #4ade80);
  }
  .led.pulse {
    background: var(--synth-accent-yellow, #facc15);
    animation: pulse 1s ease-in-out infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .led.pulse { animation: none; }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.4; }
  }
</style>

<script lang="ts">
  import {
    isAudioReady,
    isPanelCollapsed,
    onscreenPianoVisible,
    helpOverlayVisible,
  } from './stores';
  import { playUISound } from './ui/UISounds';

  import ThemeSelector       from './ui/ThemeSelector.svelte';
  import StatusStrip         from './ui/StatusStrip.svelte';
  import InstrumentSelector  from './ui/InstrumentSelector.svelte';
  import VisualizerSelector  from './ui/VisualizerSelector.svelte';
  import ColorMappingEditor  from './ui/ColorMappingEditor.svelte';
  import AudioFileInput      from './ui/AudioFileInput.svelte';
  import MidiDevicePicker    from './ui/MidiDevicePicker.svelte';
  import EffectsRack         from './ui/EffectsRack.svelte';
  import DemoGallery         from './ui/DemoGallery.svelte';

  function toggleCollapsed() {
    isPanelCollapsed.update((v) => !v);
    playUISound('switch');
  }

  function togglePiano() {
    onscreenPianoVisible.update((v) => !v);
    playUISound('switch');
  }

  function openHelp() {
    helpOverlayVisible.set(true);
    playUISound('click');
  }
</script>

{#if $isPanelCollapsed}
  <!-- Collapsed puck -->
  <button
    class="puck"
    on:click={toggleCollapsed}
    aria-label="Open control panel"
    title="Open controls"
  >
    <span class="led" class:on={$isAudioReady}></span>
    <span class="puck-label">If C Is Red</span>
  </button>
{:else}
  <div class="control-panel" role="region" aria-label="Controls">
    <!-- Header -->
    <div class="panel-header">
      <div class="header-left">
        <div class="led" class:on={$isAudioReady}></div>
        <h2 class="panel-title">If C Is Red</h2>
      </div>
      <div class="header-right">
        <button
          class="icon-btn"
          on:click={openHelp}
          aria-label="Help"
          title="Keyboard map & shortcuts"
        >?</button>
        <button
          class="icon-btn"
          class:active={$onscreenPianoVisible}
          on:click={togglePiano}
          aria-label="Toggle on-screen piano"
          title="Show on-screen piano"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="5" width="18" height="14" rx="1" />
            <line x1="9"  y1="5" x2="9"  y2="14" />
            <line x1="15" y1="5" x2="15" y2="14" />
          </svg>
        </button>
        <button
          class="icon-btn collapse"
          on:click={toggleCollapsed}
          aria-label="Collapse panel"
          title="Collapse"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
      </div>
    </div>

    <div class="panel-body">
      <StatusStrip />

      <div class="panel-divider"></div>
      <InstrumentSelector />
      <VisualizerSelector />

      <div class="panel-divider"></div>
      <ColorMappingEditor />

      <div class="panel-divider"></div>
      <EffectsRack />

      <div class="panel-divider"></div>
      <MidiDevicePicker />
      <AudioFileInput />

      <div class="panel-divider"></div>
      <DemoGallery />

      <div class="panel-divider"></div>
      <div class="theme-row">
        <span class="theme-label">Theme</span>
        <ThemeSelector />
      </div>
    </div>
  </div>
{/if}

<style>
  .control-panel {
    position: fixed;
    top: 16px;
    left: 16px;
    z-index: 100;
    width: 260px;
    max-height: calc(100vh - 32px);
    overflow-y: auto;
    box-sizing: border-box;

    background: linear-gradient(180deg, var(--synth-panel-light, #2d2d3d) 0%, var(--synth-panel, #252532) 100%);
    border: 1px solid var(--synth-border, rgba(255,255,255,0.08));
    border-radius: var(--synth-radius-md, 12px);
    box-shadow: 0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05);

    padding: 16px;
    font-family: var(--synth-font-display, 'Inter', sans-serif);

    /* Scrollbar */
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.12) transparent;
  }
  .control-panel::-webkit-scrollbar { width: 6px; }
  .control-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 3px; }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    gap: 8px;
  }
  .header-left  { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .header-right { display: flex; align-items: center; gap: 4px; }

  .led {
    width: 8px; height: 8px; border-radius: 50%;
    background: #333;
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.5);
    transition: all 0.2s ease;
    flex-shrink: 0;
  }
  .led.on {
    background: var(--synth-accent-green, #4ade80);
    box-shadow: 0 0 8px var(--synth-accent-green, #4ade80);
  }

  .panel-title {
    font-family: var(--synth-font-mono, monospace);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--synth-label, #888);
    margin: 0;
    white-space: nowrap;
  }

  .icon-btn {
    width: 24px;
    height: 24px;
    padding: 0;
    background: transparent;
    border: 1px solid transparent;
    color: var(--synth-label, #888);
    font-family: var(--synth-font-mono, monospace);
    font-size: 12px;
    font-weight: 600;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }
  .icon-btn:hover {
    background: rgba(255,255,255,0.06);
    color: #fff;
  }
  .icon-btn.active {
    background: rgba(255,107,107,0.15);
    color: var(--synth-accent, #ff6b6b);
    border-color: var(--synth-accent, #ff6b6b);
  }

  .panel-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
    margin: 12px 0;
  }

  .theme-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .theme-label {
    font-family: var(--synth-font-mono, monospace);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--synth-label, #6b6b78);
  }

  /* Collapsed puck */
  .puck {
    position: fixed;
    top: 16px;
    left: 16px;
    z-index: 100;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: linear-gradient(180deg, var(--synth-panel-light, #2d2d3d) 0%, var(--synth-panel, #252532) 100%);
    border: 1px solid var(--synth-border, rgba(255,255,255,0.08));
    border-radius: 999px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    color: var(--synth-label, #888);
    font-family: var(--synth-font-mono, monospace);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.15s;
  }
  .puck:hover {
    color: #fff;
    border-color: var(--synth-accent, #ff6b6b);
    transform: translateX(2px);
  }
  .puck-label { white-space: nowrap; }
</style>

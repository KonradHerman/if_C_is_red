<script lang="ts">
  import { COLOR_MAPPINGS, selectedColorMappingId, customColors } from '../colorMappings';
  import { NOTE_NAMES } from '../noteGeometry';
  import { playUISound } from './UISounds';

  $: activePreset = COLOR_MAPPINGS.find((m) => m.id === $selectedColorMappingId);

  function pick(id: string) {
    selectedColorMappingId.set(id);
    playUISound('click');
  }

  function handleColorChange(i: number, e: Event) {
    const val = (e.target as HTMLInputElement).value;
    customColors.update((arr) => {
      const next = [...arr];
      next[i] = val;
      return next;
    });
  }

  function startCustomize() {
    if ($selectedColorMappingId !== 'custom') {
      const preset = COLOR_MAPPINGS.find((m) => m.id === $selectedColorMappingId);
      if (preset) customColors.set([...preset.colors]);
      selectedColorMappingId.set('custom');
    }
  }
</script>

<div class="control-group">
  <h4 class="control-label">Color Mapping</h4>
  <div class="preset-row">
    {#each COLOR_MAPPINGS as map (map.id)}
      <button
        class="preset-chip"
        class:active={$selectedColorMappingId === map.id}
        title={map.description}
        on:click={() => pick(map.id)}
      >
        {map.name}
      </button>
    {/each}
    <button
      class="preset-chip"
      class:active={$selectedColorMappingId === 'custom'}
      title="Author your own 12-color palette"
      on:click={startCustomize}
    >Custom</button>
  </div>

  {#if activePreset}
    <p class="preset-desc">{activePreset.description}</p>
  {/if}

  <div class="swatches">
    {#each Array(12) as _, i}
      {@const color = $selectedColorMappingId === 'custom' ? $customColors[i] : (activePreset?.colors[i] ?? '#888')}
      <label class="swatch" title={NOTE_NAMES[i]} style="--c:{color}">
        <span class="label">{NOTE_NAMES[i]}</span>
        <input
          type="color"
          value={color}
          disabled={$selectedColorMappingId !== 'custom'}
          on:input={(e) => handleColorChange(i, e)}
        />
      </label>
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

  .preset-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 8px;
  }
  .preset-chip {
    font-family: var(--synth-font-mono, monospace);
    font-size: 9px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    padding: 5px 9px;
    border-radius: 999px;
    border: 1px solid var(--synth-border-light, rgba(255,255,255,0.12));
    background: var(--synth-bg, #1a1a24);
    color: var(--synth-text-dim, #aaa);
    cursor: pointer;
    transition: all 0.15s;
  }
  .preset-chip:hover { color: #fff; border-color: var(--synth-accent, #ff6b6b); }
  .preset-chip.active {
    background: var(--synth-accent, #ff6b6b);
    color: #fff;
    border-color: var(--synth-accent, #ff6b6b);
  }

  .preset-desc {
    font-size: 10px;
    color: var(--synth-text-dim, #888);
    margin: 0 0 8px 0;
    line-height: 1.4;
    font-style: italic;
  }

  .swatches {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 4px;
  }
  .swatch {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    cursor: pointer;
  }
  .swatch .label {
    font-family: var(--synth-font-mono, monospace);
    font-size: 8px;
    color: var(--synth-label, #6b6b78);
  }
  .swatch input[type="color"] {
    width: 100%;
    height: 24px;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 4px;
    background: var(--c);
    padding: 0;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
  }
  .swatch input[type="color"]:disabled { cursor: not-allowed; opacity: 0.7; }
  .swatch input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
  .swatch input[type="color"]::-webkit-color-swatch        { border: none; border-radius: 3px; }
  .swatch input[type="color"]::-moz-color-swatch           { border: none; border-radius: 3px; }
</style>

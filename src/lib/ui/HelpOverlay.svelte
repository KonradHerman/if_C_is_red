<script lang="ts">
  import {
    helpOverlayVisible,
    midiStatus,
    midiInputs,
    keyboardOctaveOffset,
  } from '../stores';
  import { keyboardToNoteMap } from '../mappings';
  import { NOTE_NAMES, pitchClass } from '../noteGeometry';
  import { activeColorMap } from '../colorMappings';

  const rows = [
    ['q','w','e','r','t','y','u','i','o','p'],
    ['a','s','d','f','g','h','j','k','l'],
    ['z','x','c','v','b','n','m'],
  ];

  function noteFor(key: string): number | null {
    const base = keyboardToNoteMap[key];
    if (base === undefined) return null;
    return base + $keyboardOctaveOffset * 12;
  }

  function close() { helpOverlayVisible.set(false); }

  function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') close(); }
</script>

<svelte:window on:keydown={handleKey} />

{#if $helpOverlayVisible}
  <div
    class="scrim"
    role="button"
    tabindex="-1"
    on:click={close}
    on:keydown={(e) => e.key === 'Enter' && close()}
  >
    <div class="sheet" role="dialog" aria-label="Help" tabindex="-1" on:click|stopPropagation on:keydown|stopPropagation>
      <header>
        <h2>How to play</h2>
        <button class="close" on:click={close} aria-label="Close">✕</button>
      </header>

      <section>
        <h3>Keyboard</h3>
        <p class="hint">Your typing keyboard becomes a piano. Octave offset: <strong>{$keyboardOctaveOffset > 0 ? '+' : ''}{$keyboardOctaveOffset}</strong> (use ↑ / ↓ to change).</p>
        <div class="rows">
          {#each rows as row, rowIdx}
            <div class="row" style="padding-left:{rowIdx * 18}px">
              {#each row as key}
                {@const n = noteFor(key)}
                {@const color = n !== null ? $activeColorMap[pitchClass(n)] : '#333'}
                <div class="key" style="--c:{color}">
                  <span class="cap">{key.toUpperCase()}</span>
                  {#if n !== null}
                    <span class="note">{NOTE_NAMES[pitchClass(n)]}{Math.floor(n/12)-1}</span>
                  {/if}
                </div>
              {/each}
            </div>
          {/each}
        </div>
      </section>

      <section>
        <h3>Shortcuts</h3>
        <dl class="shortcuts">
          <dt><kbd>↑</kbd> / <kbd>↓</kbd></dt><dd>Shift octave</dd>
          <dt><kbd>Shift</kbd> + key</dt><dd>Louder (accented) note</dd>
          <dt><kbd>1</kbd>…<kbd>9</kbd></dt><dd>Switch visualizer</dd>
          <dt><kbd>[</kbd> / <kbd>]</kbd></dt><dd>Previous / next instrument</dd>
          <dt><kbd>Space</kbd></dt><dd>Record start / stop</dd>
          <dt><kbd>?</kbd></dt><dd>Show / hide this help</dd>
          <dt><kbd>Esc</kbd></dt><dd>Close overlays</dd>
        </dl>
      </section>

      <section>
        <h3>MIDI</h3>
        {#if $midiStatus === 'ready'}
          {#if $midiInputs.length === 0}
            <p class="hint">MIDI is available but no devices are connected.</p>
          {:else}
            <ul class="midi-list">
              {#each $midiInputs as input}
                <li><span class="led {input.state === 'connected' ? 'on' : ''}"></span>{input.name}</li>
              {/each}
            </ul>
          {/if}
        {:else if $midiStatus === 'unsupported'}
          <p class="hint">Web MIDI isn't supported in this browser. Try Chrome, Edge, or Opera.</p>
        {:else}
          <p class="hint">MIDI access hasn't been granted.</p>
        {/if}
      </section>
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.75);
    backdrop-filter: blur(6px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .sheet {
    width: min(720px, 100%);
    max-height: 90vh;
    overflow: auto;
    background: linear-gradient(180deg, var(--synth-panel-light, #2d2d3d) 0%, var(--synth-panel, #252532) 100%);
    border: 1px solid var(--synth-border, rgba(255,255,255,0.08));
    border-radius: var(--synth-radius-lg, 14px);
    box-shadow: 0 24px 60px rgba(0,0,0,0.6);
    padding: 28px 32px;
    color: var(--synth-text, #e0e0e8);
    font-family: var(--synth-font-display, system-ui);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  header h2 {
    margin: 0;
    font-size: 22px;
    letter-spacing: -0.5px;
  }
  .close {
    border: none;
    background: transparent;
    color: var(--synth-text-dim, #888);
    font-size: 16px;
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 50%;
  }
  .close:hover { color: #fff; background: rgba(255,255,255,0.08); }

  section { margin-top: 20px; }
  section h3 {
    font-family: var(--synth-font-mono, monospace);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--synth-label, #6b6b78);
    margin: 0 0 10px 0;
  }
  .hint { color: var(--synth-text-dim, #888); font-size: 12px; margin: 4px 0 12px; }
  .hint strong { color: var(--synth-accent, #ff6b6b); font-weight: 600; }

  .rows { display: flex; flex-direction: column; gap: 6px; }
  .row   { display: flex; gap: 4px; }
  .key {
    flex: 0 0 auto;
    width: 44px;
    height: 54px;
    background: var(--synth-bg, #1a1a24);
    border: 1px solid rgba(255,255,255,0.08);
    border-bottom: 3px solid var(--c);
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }
  .key .cap {
    font-family: var(--synth-font-mono, monospace);
    font-weight: 600;
    font-size: 14px;
    color: #fff;
  }
  .key .note {
    font-family: var(--synth-font-mono, monospace);
    font-size: 9px;
    color: var(--c);
    opacity: 0.85;
  }

  .shortcuts {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 6px 18px;
    margin: 0;
  }
  .shortcuts dt { font-size: 12px; color: var(--synth-text-dim, #aaa); display: flex; gap: 4px; align-items: center; }
  .shortcuts dd { margin: 0; font-size: 12px; color: #fff; }
  kbd {
    font-family: var(--synth-font-mono, monospace);
    font-size: 10px;
    background: var(--synth-bg, #1a1a24);
    border: 1px solid var(--synth-border-light, rgba(255,255,255,0.12));
    border-bottom-width: 2px;
    border-radius: 4px;
    padding: 2px 6px;
    color: #fff;
  }

  .midi-list { list-style: none; padding: 0; margin: 0; }
  .midi-list li {
    font-family: var(--synth-font-mono, monospace);
    font-size: 12px;
    padding: 6px 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .led {
    width: 8px; height: 8px; border-radius: 50%;
    background: #333;
  }
  .led.on {
    background: var(--synth-accent-green, #4ade80);
    box-shadow: 0 0 8px var(--synth-accent-green, #4ade80);
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte';
  import { selectedTheme } from '../stores';
  import { playUISound } from './UISounds';

  const themes = [
    { id: 'default',    name: 'Dark Matter' },
    { id: 'light',      name: 'Paper' },
    { id: 'vintage',    name: 'Vintage Wood' },
    { id: 'industrial', name: 'Industrial' },
  ];

  function apply(theme: string) {
    if (theme === 'default') delete document.body.dataset.theme;
    else document.body.dataset.theme = theme;
  }

  onMount(() => apply($selectedTheme));

  function handleChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    selectedTheme.set(target.value);
    apply(target.value);
    playUISound('switch');
  }
</script>

<select
  class="theme-select"
  value={$selectedTheme}
  on:change={handleChange}
  aria-label="Theme"
>
  {#each themes as theme}
    <option value={theme.id}>{theme.name}</option>
  {/each}
</select>

<style>
  .theme-select {
    background: var(--synth-bg, #1a1a24);
    border: 1px solid var(--synth-border-light, rgba(255,255,255,0.12));
    border-radius: var(--synth-radius-sm, 6px);
    color: var(--synth-text-dim, #aaa);
    font-family: var(--synth-font-mono, monospace);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    padding: 6px 24px 6px 10px;
    cursor: pointer;
    transition: all 0.15s ease;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
  }
  .theme-select:hover {
    color: var(--synth-text, #fff);
    border-color: var(--synth-accent, #ff6b6b);
  }
  .theme-select:focus {
    outline: none;
    border-color: var(--synth-accent, #ff6b6b);
    box-shadow: 0 0 0 2px rgba(255, 107, 107, 0.2);
  }
</style>

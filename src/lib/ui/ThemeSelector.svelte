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
    background: transparent;
    border: none;
    color: var(--synth-label, #888);
    font-family: var(--synth-font-mono, monospace);
    font-size: 10px;
    text-transform: uppercase;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.2s;
  }
  .theme-select:hover { opacity: 1; color: var(--synth-text, #fff); }
  .theme-select:focus { outline: none; }
</style>

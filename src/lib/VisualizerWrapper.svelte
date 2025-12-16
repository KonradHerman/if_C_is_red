<script lang="ts">
  // Import stores needed for dynamic selection
  import {
    activeNotes as activeNotesStore,
    selectedVisualizerName,
  } from "./stores";

  // Import all possible visualizer components
  import BallVisualizer from "./visualizers/BallVisualizer.svelte";
  import BarsVisualizer from "./visualizers/BarsVisualizer.svelte";
  import ParticleVisualizer from "./visualizers/ParticleVisualizer.svelte";
  import CircularVisualizer from "./visualizers/CircularVisualizer.svelte";

  // Map visualizer names (from store) to the imported components
  const visualizerComponents: { [key: string]: any } = {
    Ball: BallVisualizer,
    Bars: BarsVisualizer,
    Particle: ParticleVisualizer,
    Circular: CircularVisualizer,
  };

  // Derive the current component based on the selected name
  $: currentVisualizerComponent = visualizerComponents[$selectedVisualizerName];

  // The ActiveNote type definition is likely needed by Visualizer.svelte internally,
  // but this wrapper doesn't need to explicitly import it unless it uses the type.
  // import type { ActiveNote } from './stores';

  // Subscribe to the activeNotes store
  // The store holds a Map<string | number, ActiveNote>
  // $: console.log('VisualizerWrapper: Active notes count:', $activeNotesStore.size);
</script>

<!-- Use svelte:component to dynamically render the selected visualizer -->
{#if currentVisualizerComponent}
  <svelte:component
    this={currentVisualizerComponent}
    activeNotes={$activeNotesStore}
  />
{:else}
  <!-- Optional: Fallback if the selected visualizer name is invalid -->
  <p>Error: Visualizer '{$selectedVisualizerName}' not found.</p>
{/if}

<!-- No style needed unless wrapping element requires it -->

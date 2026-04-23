<script lang="ts">
  import {
    activeNotes as activeNotesStore,
    selectedVisualizerName,
  } from './stores';

  import BallVisualizer          from './visualizers/BallVisualizer.svelte';
  import BarsVisualizer          from './visualizers/BarsVisualizer.svelte';
  import ParticleVisualizer      from './visualizers/ParticleVisualizer.svelte';
  import CircularVisualizer      from './visualizers/CircularVisualizer.svelte';
  import PianoRollVisualizer     from './visualizers/PianoRollVisualizer.svelte';
  import HarmonicWheelVisualizer from './visualizers/HarmonicWheelVisualizer.svelte';
  import SpectrogramVisualizer   from './visualizers/SpectrogramVisualizer.svelte';
  import PaintingVisualizer      from './visualizers/PaintingVisualizer.svelte';
  import ShaderVisualizer        from './visualizers/ShaderVisualizer.svelte';
  import StarfieldVisualizer     from './visualizers/StarfieldVisualizer.svelte';
  import KeysVisualizer          from './visualizers/KeysVisualizer.svelte';

  const visualizerComponents: Record<string, typeof BallVisualizer> = {
    Ball:          BallVisualizer,
    Bars:          BarsVisualizer,
    Particle:      ParticleVisualizer,
    Circular:      CircularVisualizer,
    PianoRoll:     PianoRollVisualizer,
    HarmonicWheel: HarmonicWheelVisualizer,
    Spectrogram:   SpectrogramVisualizer,
    Painting:      PaintingVisualizer,
    Shader:        ShaderVisualizer,
    Starfield:     StarfieldVisualizer,
    Keys:          KeysVisualizer,
  };

  $: current = visualizerComponents[$selectedVisualizerName] ?? BallVisualizer;
</script>

<svelte:component this={current} activeNotes={$activeNotesStore} />

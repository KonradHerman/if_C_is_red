<script lang="ts">
  import {
    activeNotes as activeNotesStore,
    selectedVisualizerName,
  } from './stores';

  import BallVisualizer          from './visualizers/BallVisualizer.svelte';
  import BarsVisualizer          from './visualizers/BarsVisualizer.svelte';
  import OctaveBarsVisualizer    from './visualizers/OctaveBarsVisualizer.svelte';
  import RadialBarsVisualizer    from './visualizers/RadialBarsVisualizer.svelte';
  import CircularVisualizer      from './visualizers/CircularVisualizer.svelte';
  import PianoRollVisualizer     from './visualizers/PianoRollVisualizer.svelte';
  import HarmonicWheelVisualizer from './visualizers/HarmonicWheelVisualizer.svelte';
  import SpectrogramVisualizer   from './visualizers/SpectrogramVisualizer.svelte';
  import StarfieldVisualizer     from './visualizers/StarfieldVisualizer.svelte';
  import KeysVisualizer          from './visualizers/KeysVisualizer.svelte';

  const visualizerComponents: Record<string, typeof BallVisualizer> = {
    Ball:          BallVisualizer,
    Bars:          BarsVisualizer,
    OctaveBars:    OctaveBarsVisualizer,
    RadialBars:    RadialBarsVisualizer,
    Circular:      CircularVisualizer,
    PianoRoll:     PianoRollVisualizer,
    HarmonicWheel: HarmonicWheelVisualizer,
    Spectrogram:   SpectrogramVisualizer,
    Starfield:     StarfieldVisualizer,
    Keys:          KeysVisualizer,
  };

  $: current = visualizerComponents[$selectedVisualizerName] ?? BallVisualizer;
</script>

<svelte:component this={current} activeNotes={$activeNotesStore} />

<script lang="ts">
  import { onMount } from 'svelte';
  import * as Tone from 'tone';
  import VisualizerWrapper from './lib/VisualizerWrapper.svelte';
  import {
    activeNotes as activeNotesStore,
    selectedInstrumentName as selectedInstrumentNameStore,
    isAudioReady as isAudioReadyStore,
    isLoadingSynth as isLoadingSynthStore,
    synthInstance,
    audioControls,
    instrumentOptions,
    type InstrumentOption,
  } from './lib/stores';
  import { getChainInput } from './lib/audioChain';
  import { readShareFromUrl, applyShare } from './lib/shareLink';
  import { activeColorMap } from './lib/colorMappings';

  import ControlPanel         from './lib/ControlPanel.svelte';
  import KeyboardInputHandler from './lib/KeyboardInputHandler.svelte';
  import MidiInputHandler     from './lib/MidiInputHandler.svelte';
  import RecordingControls    from './lib/RecordingControls.svelte';
  import HelpOverlay          from './lib/ui/HelpOverlay.svelte';
  import OnscreenPiano        from './lib/ui/OnscreenPiano.svelte';
  import KeyboardShortcuts    from './lib/ui/KeyboardShortcuts.svelte';
  import './styles/synth-theme.css';

  let firstNotePlayed = false;
  let synth: Tone.PolySynth<any> | Tone.Sampler | null = null;
  let currentInstrumentName: string | null = null;
  let hasMounted = false;
  let setupRequestId = 0;

  $: if (!firstNotePlayed && $activeNotesStore.size > 0) {
    firstNotePlayed = true;
  }

  async function setupSynth(option: InstrumentOption) {
    const requestId = ++setupRequestId;

    if (synth) {
      if ('releaseAll' in synth) synth.releaseAll();
      synth.dispose();
      synth = null;
      synthInstance.set(null);
    }

    isLoadingSynthStore.set(true);
    try {
      const nextSynth = option.factory();
      nextSynth.connect(getChainInput());
      await Tone.loaded();

      if (requestId !== setupRequestId) {
        if ('releaseAll' in nextSynth) nextSynth.releaseAll();
        nextSynth.dispose();
        return;
      }

      synth = nextSynth;
      synthInstance.set(nextSynth);
      currentInstrumentName = option.name;
    } catch (e) {
      if (requestId !== setupRequestId) return;
      console.error('Synth setup error', e);
      synth = null;
      synthInstance.set(null);
      currentInstrumentName = null;
      isAudioReadyStore.set(false);
    } finally {
      if (requestId === setupRequestId) {
        isLoadingSynthStore.set(false);
      }
    }
  }

  $: {
    if (hasMounted) {
      const requested = $selectedInstrumentNameStore;
      if (requested !== currentInstrumentName) {
        const newOption = instrumentOptions.find((o) => o.name === requested);
        if (newOption) {
          isAudioReadyStore.set(false);
          setupSynth(newOption);
        }
      }
    }
  }

  let isInitializing = false;
  async function initAudio() {
    if ($isAudioReadyStore || isInitializing) return;
    isInitializing = true;
    try {
      if (Tone.context.state !== 'running') await Tone.start();

      let currentSynth = $synthInstance;
      if (!currentSynth) {
        const opt = instrumentOptions.find((o) => o.name === $selectedInstrumentNameStore);
        if (opt) { await setupSynth(opt); currentSynth = $synthInstance; }
        else throw new Error('No instrument option');
      }

      await Tone.loaded();

      const finalSynth = $synthInstance;
      const ok = finalSynth && (!(finalSynth instanceof Tone.Sampler) || finalSynth.loaded);
      isAudioReadyStore.set(!!ok);
    } catch (e) {
      console.error('initAudio error', e);
      isAudioReadyStore.set(false);
    } finally {
      isInitializing = false;
    }
  }

  onMount(() => {
    // Apply shared URL state before anything else.
    const shared = readShareFromUrl();
    if (shared) applyShare(shared);

    audioControls.set({ initAudio });
    hasMounted = true;

    // Make palette colors available to CSS.
    const unsubColor = activeColorMap.subscribe((palette) => {
      palette.forEach((c, i) => {
        document.documentElement.style.setProperty(`--note-color-${i}`, c);
      });
    });

    return () => {
      if (synth) { synth.releaseAll(); synth.dispose(); }
      synthInstance.set(null);
      audioControls.set(null);
      unsubColor();
    };
  });
</script>

<svelte:head>
  <title>If C Is Red</title>
  <meta name="description" content="Play music and see it in color. A synesthetic synthesizer in the browser — keyboard, MIDI, or audio file." />
  <meta property="og:title" content="If C Is Red" />
  <meta property="og:description" content="Play music and see it in color." />
  <meta property="og:type" content="website" />
</svelte:head>

<main>
  <VisualizerWrapper />

  {#if !firstNotePlayed}
    <div class="instructions" aria-live="polite">
      <h1>If C Is Red</h1>
      <p>Press any key, plug in a MIDI controller, or tap the on-screen piano.</p>
      <p class="sub">Every note has a color — play a chord and see it bloom.</p>
    </div>
  {/if}

  <ControlPanel />
  <RecordingControls />

  <KeyboardInputHandler />
  <MidiInputHandler />
  <KeyboardShortcuts />
  <HelpOverlay />
  <OnscreenPiano />
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background-color: #222;
    color: #eee;
    overflow: hidden;
    font-family: var(--synth-font-display, 'Inter', system-ui, sans-serif);
  }

  main {
    position: relative;
    width: 100vw;
    height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
  }

  .instructions {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    z-index: 10;
    background-color: rgba(0, 0, 0, 0.55);
    padding: 28px 48px;
    border-radius: 14px;
    pointer-events: none;
    backdrop-filter: blur(6px);
  }
  .instructions h1 {
    margin: 0 0 0.4em;
    font-size: clamp(2.4em, 6vw, 4em);
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .instructions p {
    margin: 0 0 0.3em;
    font-size: clamp(1em, 2vw, 1.6em);
    color: rgba(255,255,255,0.92);
  }
  .instructions .sub {
    font-size: clamp(0.8em, 1.3vw, 1em);
    color: rgba(255,255,255,0.55);
  }
</style>

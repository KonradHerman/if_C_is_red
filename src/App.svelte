<script lang="ts">
  import { onMount } from 'svelte';
  import * as Tone from 'tone';
  import VisualizerWrapper from './lib/VisualizerWrapper.svelte';
  import {
    activeNotes as activeNotesStore,
    selectedInstrumentName as selectedInstrumentNameStore,
    isAudioReady as isAudioReadyStore,
    isLoadingSynth as isLoadingSynthStore,
    audioUnlockBlocked,
    synthInstance,
    audioControls,
    instrumentOptions,
    type InstrumentOption,
  } from './lib/stores';
  import { getChainInput, ensureEffects } from './lib/audioChain';
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

  /** Returns true on success, false on error / superseded by a newer call. */
  async function setupSynth(option: InstrumentOption): Promise<boolean> {
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
        return false;
      }

      synth = nextSynth;
      synthInstance.set(nextSynth);
      currentInstrumentName = option.name;
      return true;
    } catch (e) {
      if (requestId !== setupRequestId) return false;
      console.error('Synth setup error', e);
      synth = null;
      synthInstance.set(null);
      currentInstrumentName = null;
      isAudioReadyStore.set(false);
      return false;
    } finally {
      if (requestId === setupRequestId) {
        isLoadingSynthStore.set(false);
      }
    }
  }

  // Start setting up the selected instrument as soon as the component mounts.
  // Plain audio-node creation + Sampler.decodeAudioData are safe on a suspended
  // context (they don't produce sound, and Firefox warns but doesn't actually
  // block the decode). Warming Tone's internal state at mount time also avoids
  // a hang in Tone.start() on some Firefox profiles where the wrapper stalls
  // if no source has been created yet. Audible playback still waits for the
  // user gesture that resumes the AudioContext.
  $: {
    if (hasMounted) {
      const requested = $selectedInstrumentNameStore;
      if (requested !== currentInstrumentName) {
        const newOption = instrumentOptions.find((o) => o.name === requested);
        if (newOption) {
          isAudioReadyStore.set(false);
          setupSynth(newOption).then((ok) => {
            // Restore ready only if the setup actually completed AND the
            // context is already running (i.e. the user had unlocked audio
            // before this swap). Otherwise wait for the user's next gesture
            // to flip it via initAudio().
            if (ok && (Tone.context.state as string) === 'running') {
              isAudioReadyStore.set(true);
            }
          });
        }
      }
    }
  }

  // Toggle with ?keydebug / #keydebug in the URL.
  const KEY_DEBUG = typeof window !== 'undefined'
    && /[?#&]keydebug\b/.test(window.location.search + window.location.hash);
  const ilog = (...args: unknown[]) => { if (KEY_DEBUG) console.log('[init]', ...args); };

  function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return Promise.race([
      p,
      new Promise<T>((_, rej) => {
        timer = setTimeout(() => rej(new Error(`timeout ${ms}ms: ${label}`)), ms);
      }),
    ]).finally(() => { if (timer) clearTimeout(timer); });
  }

  /**
   * Unlock the AudioContext. Must run from inside a user gesture handler
   * (pointerdown / click / keydown). Firefox's autoplay policy in particular
   * may reject audio unlock on some gesture types — we handle that by
   * exposing audioUnlockBlocked so the UI can prompt for a click.
   */
  async function unlockAudio(): Promise<boolean> {
    if ((Tone.context.state as string) === 'running') return true;
    try {
      await withTimeout(Tone.start(), 1200, 'Tone.start');
      ilog('unlock: Tone.start resolved, state =', Tone.context.state);
    } catch (e) {
      ilog('unlock: Tone.start failed:', e);
    }
    if ((Tone.context.state as string) === 'running') return true;

    // Fall back to resuming the raw native context directly — some Tone
    // internal machinery can stall while the underlying context is fine.
    const raw = (Tone.getContext() as unknown as { rawContext?: AudioContext }).rawContext;
    if (raw) {
      try {
        await withTimeout(raw.resume(), 800, 'raw.resume');
        ilog('unlock: raw.resume resolved, state =', raw.state);
      } catch (e) {
        ilog('unlock: raw.resume failed:', e);
      }
    }

    return (Tone.context.state as string) === 'running';
  }

  let isInitializing = false;
  async function initAudio() {
    if ($isAudioReadyStore || isInitializing) return;
    isInitializing = true;
    try {
      const unlocked = await unlockAudio();
      if (!unlocked) {
        console.warn('[init] audio could not be unlocked; prompting for click');
        audioUnlockBlocked.set(true);
        return;
      }
      audioUnlockBlocked.set(false);

      ensureEffects();
      ilog('effects ensured');

      // The reactive block at mount already kicked off setupSynth for the
      // default instrument; only build a fresh one if there's nothing in
      // flight AND nothing already loaded. isLoadingSynth (managed by
      // setupSynth itself) is the authoritative "in flight" signal - we
      // deliberately don't twiddle it here so our own flag doesn't
      // collide with the guard. await Tone.loaded() below will wait on
      // any in-flight setup either way.
      if (!$synthInstance && !$isLoadingSynthStore) {
        const opt = instrumentOptions.find((o) => o.name === $selectedInstrumentNameStore);
        if (!opt) throw new Error('No instrument option');
        await setupSynth(opt);
        ilog('setupSynth done, synthInstance =', !!$synthInstance);
      } else {
        ilog('deferring to in-flight / existing synth; synthInstance =', !!$synthInstance, 'loading =', $isLoadingSynthStore);
      }

      await Tone.loaded();
      ilog('Tone.loaded resolved');

      const finalSynth = $synthInstance;
      const loaded = !(finalSynth instanceof Tone.Sampler) || finalSynth.loaded;
      ilog('finalSynth =', !!finalSynth, 'loaded =', loaded);
      const ok = !!finalSynth && loaded;
      isAudioReadyStore.set(ok);
    } catch (e) {
      console.error('[init] initAudio error', e);
      isAudioReadyStore.set(false);
    } finally {
      isInitializing = false;
    }
  }

  onMount(() => {
    const shared = readShareFromUrl();
    if (shared) applyShare(shared);

    audioControls.set({ initAudio });
    hasMounted = true;

    // Document-level audio unlock. pointerdown / click are the most reliable
    // activation-eligible events in Firefox; keydown can be rejected on some
    // profiles / autoplay settings. Subsequent keypresses then see
    // isAudioReady === true and skip the unlock dance entirely.
    const unlock = () => { void initAudio(); };
    document.addEventListener('pointerdown', unlock, { capture: true });
    document.addEventListener('click',       unlock, { capture: true });

    const unsubColor = activeColorMap.subscribe((palette) => {
      palette.forEach((c, i) => {
        document.documentElement.style.setProperty(`--note-color-${i}`, c);
      });
    });

    return () => {
      document.removeEventListener('pointerdown', unlock, { capture: true });
      document.removeEventListener('click',       unlock, { capture: true });
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

  {#if !firstNotePlayed && !$audioUnlockBlocked}
    <div class="instructions" aria-live="polite">
      <h1>If C Is Red</h1>
      <p>Press any key, plug in a MIDI controller, or tap the on-screen piano.</p>
      <p class="sub">Every note has a color — play a chord and see it bloom.</p>
    </div>
  {/if}

  {#if $audioUnlockBlocked}
    <div class="unlock-overlay" aria-live="polite">
      <h2>Tap anywhere to enable audio</h2>
      <p>Your browser is blocking audio until you interact with the page.</p>
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

  .unlock-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    z-index: 20;
    background: rgba(0, 0, 0, 0.82);
    border: 1px solid var(--synth-accent, #ff6b6b);
    padding: 24px 40px;
    border-radius: 14px;
    backdrop-filter: blur(8px);
    box-shadow: 0 0 40px rgba(255, 107, 107, 0.25);
    pointer-events: none;
  }
  .unlock-overlay h2 {
    margin: 0 0 8px;
    font-size: clamp(1.4em, 3vw, 2em);
    color: var(--synth-accent, #ff6b6b);
    font-weight: 700;
  }
  .unlock-overlay p {
    margin: 0;
    font-size: clamp(0.9em, 1.4vw, 1.1em);
    color: rgba(255, 255, 255, 0.75);
  }
</style>

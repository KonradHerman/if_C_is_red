<script context="module" lang="ts">
  // Define and export the interface from the module context
  export interface ActiveNote {
    id: string | number; // Unique ID (string for keyboard key+note, number for MIDI note)
    noteNumber: number;
    velocity: number; // Normalized 0.0 - 1.0
  }
</script>

<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { noteToColorMap } from "./lib/mappings"; // Keep noteToColorMap if Visualizer needs it (indirectly)
  import * as Tone from "tone"; // Import Tone.js
  // Remove direct import of Visualizer
  // import Visualizer from './lib/Visualizer.svelte';
  // Import the wrapper instead
  import VisualizerWrapper from "./lib/VisualizerWrapper.svelte";

  // Import stores and instrument definitions
  import {
    activeNotes as activeNotesStore, // Store is now used by VisualizerWrapper
    selectedInstrumentName as selectedInstrumentNameStore,
    isAudioReady as isAudioReadyStore,
    synthInstance,
    audioControls,
    instrumentOptions, // Import from stores
    type InstrumentOption,
  } from "./lib/stores";

  // Import the new component
  import InstrumentSelector from "./lib/InstrumentSelector.svelte";
  import VisualizerSelector from "./lib/VisualizerSelector.svelte"; // Import the new selector
  import KeyboardInputHandler from "./lib/KeyboardInputHandler.svelte"; // Import Keyboard handler
  import MidiInputHandler from "./lib/MidiInputHandler.svelte"; // Import MIDI handler

  // --- State Variables ---
  let firstNotePlayed = false;
  let synth: Tone.PolySynth<any> | Tone.Sampler | null = null;
  let currentInstrumentName: string | null = null; // Track the name of the successfully setup synth

  // Map to track currently pressed keyboard keys and their Tone.js note name
  // const pressedKeyboardKeys: Map<string, { noteName: string, noteId: string }> = new Map();
  // Map to store keyboard note timeout IDs
  // const keyboardTimeouts: Map<string, number> = new Map();

  // Function to hide text
  function hideText() {
    if (!firstNotePlayed) {
      firstNotePlayed = true;
      console.log("App.svelte: First note played, hiding instructions.");
    }
  }

  // Reactive statement to detect first note and hide text
  $: if (!firstNotePlayed && $activeNotesStore.size > 0) {
    hideText();
  }

  // --- Synth Creation/Update ---
  async function setupSynth(option: InstrumentOption) {
    if (synth) {
      if ("releaseAll" in synth) {
        synth.releaseAll();
      }
      synth.dispose();
      console.log("Previous synth disposed.");
      synth = null;
      synthInstance.set(null);
      // Don't reset currentInstrumentName here, wait for successful setup
    }

    console.log(`Setting up ${option.name}... Config:`, option.config);

    try {
      if (option.synthType === Tone.Sampler) {
        synth = new Tone.Sampler(
          option.config as Partial<Tone.SamplerOptions>,
        ).toDestination();
        console.log(`Sampler created: ${option.name}. Waiting for samples...`);
        await Tone.loaded();
        console.log(`Sampler ready: ${option.name}`);
      } else if (option.synthType === Tone.PluckSynth) {
        // PluckSynth doesn't support PolySynth - use PolySynth with basic Synth for pluck-like sound
        synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "sine" },
          envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.4 },
        }).toDestination();
        console.log(`Pluck-style PolySynth created: ${option.name}`);
      } else if (option.synthType === Tone.MetalSynth) {
        // MetalSynth doesn't support PolySynth - use PolySynth with FM for bell-like sound
        synth = new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: 8,
          modulationIndex: 20,
          envelope: { attack: 0.001, decay: 1.2, sustain: 0, release: 0.3 },
        }).toDestination();
        console.log(`Bell-style PolySynth created: ${option.name}`);
      } else if (option.synthType === Tone.MonoSynth) {
        // MonoSynth - wrap in PolySynth with Synth and similar characteristics
        synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "sawtooth" },
          envelope: { attack: 0.005, decay: 0.1, sustain: 0.9, release: 0.4 },
        }).toDestination();
        console.log(`Bass-style PolySynth created: ${option.name}`);
      } else if (option.synthType === Tone.DuoSynth) {
        // DuoSynth doesn't work with PolySynth - use Synth with long attack for pad sound
        synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "sine" },
          envelope: { attack: 0.8, decay: 0.3, sustain: 0.6, release: 2 },
        }).toDestination();
        console.log(`Pad-style PolySynth created: ${option.name}`);
      } else {
        synth = new Tone.PolySynth(
          option.synthType as any,
          option.config,
        ).toDestination();
        console.log(`PolySynth created: ${option.name}`);
      }
      await Tone.loaded();
      console.log(`Synth ready: ${option.name}`);
      synthInstance.set(synth);
      currentInstrumentName = option.name; // Update current name on success
    } catch (error) {
      console.error("Error during synth setup:", error);
      synth = null;
      synthInstance.set(null);
      currentInstrumentName = null; // Reset current name on error
      isAudioReadyStore.set(false);
    }
  }

  // Reactive statement for instrument change
  $: {
    const requestedInstrumentName = $selectedInstrumentNameStore;

    // Only proceed if the requested name is different from the current one
    if (requestedInstrumentName !== currentInstrumentName) {
      const newOption = instrumentOptions.find(
        (opt: InstrumentOption) => opt.name === requestedInstrumentName,
      );
      if (newOption) {
        console.log(
          "Selected instrument store changed to:",
          requestedInstrumentName,
          "(Previously:",
          currentInstrumentName,
          ")",
        );
        isAudioReadyStore.set(false); // Needs re-init/check after setup
        setupSynth(newOption); // setupSynth handles disposal and updates currentInstrumentName on success
      } else {
        console.warn(
          `Instrument option not found for name: ${requestedInstrumentName}`,
        );
      }
    }
  }

  // Function to initialize AudioContext and ensure synth is ready
  let isInitializing = false; // Prevent race conditions
  async function initAudio() {
    if ($isAudioReadyStore || isInitializing) return;
    isInitializing = true;
    try {
      if (Tone.context.state !== "running") {
        await Tone.start();
        console.log("Audio context started by user interaction.");
      }

      let currentSynth = $synthInstance;
      // Ensure synth instance exists (it should be set by the reactive block or initial setup)
      if (!currentSynth) {
        console.log("Synth was null in initAudio, attempting setup...");
        // Add type to opt
        const currentOption = instrumentOptions.find(
          (opt: InstrumentOption) => opt.name === $selectedInstrumentNameStore,
        );
        if (currentOption) {
          await setupSynth(currentOption);
          currentSynth = $synthInstance; // Re-check store
        } else {
          console.error(
            "Cannot initialize audio: No valid instrument option found.",
          );
          throw new Error("Synth setup failed in initAudio");
        }
      }

      // If synth exists, check if it needs loading
      if (currentSynth instanceof Tone.Sampler && !currentSynth.loaded) {
        console.log("Sampler awaiting Tone.loaded() in initAudio.");
        await Tone.loaded();
      } else if (currentSynth) {
        // For PolySynth, ensure Tone.loaded() is complete (usually fast)
        await Tone.loaded();
      }

      // Final check if synth is ready
      const finalSynth = $synthInstance;
      if (
        finalSynth &&
        ((finalSynth instanceof Tone.Sampler && finalSynth.loaded) ||
          !(finalSynth instanceof Tone.Sampler))
      ) {
        isAudioReadyStore.set(true); // Update store
        console.log("Audio and Synth are ready.");
      } else {
        console.error("Synth initialization failed within initAudio.");
        isAudioReadyStore.set(false);
      }
    } catch (e) {
      console.error("Error during audio initialization:", e);
      isAudioReadyStore.set(false);
    } finally {
      isInitializing = false;
    }
  }

  // Provide audio control functions via the store
  onMount(() => {
    audioControls.set({
      initAudio: initAudio,
      // playNote: (note, duration, time, velocity) => {
      //   if ($isAudioReadyStore && $synthInstance) {
      //     $synthInstance.triggerAttackRelease(note, duration, time, velocity);
      //   }
      // },
      // releaseNote: (note, time) => {
      //    if ($isAudioReadyStore && $synthInstance) {
      //      $synthInstance.triggerRelease(note, time);
      //    }
      // }
    });

    // Initial synth setup based on default store value
    // Add type to opt
    const initialOption = instrumentOptions.find(
      (opt: InstrumentOption) => opt.name === $selectedInstrumentNameStore,
    );
    if (initialOption) {
      // Don't await here, let it setup in background. initAudio will handle waiting if needed.
      setupSynth(initialOption);
    }

    // MIDI Setup moved to MidiInputHandler
    // requestMIDIAccess logic removed

    // Keyboard listeners moved to KeyboardInputHandler
    // window.addEventListener logic removed

    return () => {
      // Cleanup:
      if (synth) {
        synth.releaseAll();
        synth.dispose();
        console.log("Local synth disposed on component destroy.");
      }
      synthInstance.set(null); // Ensure store is also null
      audioControls.set(null); // Clear controls
      // Remove event listeners handled by child components

      // Clear keyboard timeouts
      // keyboardTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
      // keyboardTimeouts.clear();
    };
  });

  // --- MIDI functions removed ---
  // async function handleMIDIMessage(message: WebMidi.MIDIMessageEvent) { ... }
  // function processMidiEvent(message: WebMidi.MIDIMessageEvent) { ... }

  // --- Keyboard functions removed ---
</script>

<svelte:head>
  <title>If C Is Red</title>
</svelte:head>

<main>
  <!-- Add the Instrument Selector Component -->
  <InstrumentSelector />
  <!-- Add the Visualizer Selector Component -->
  <VisualizerSelector />

  <!-- Instructions Text -->
  {#if !firstNotePlayed}
    <div class="instructions">
      <h1>If C Is Red</h1>
      <p>
        Press any key on your keyboard or MIDI controller to hear it in color.
      </p>
    </div>
  {/if}

  <!-- Use the Visualizer Wrapper Component -->
  <VisualizerWrapper />

  <!-- Mount Input Handlers -->
  <KeyboardInputHandler />
  <MidiInputHandler />
</main>

<style>
  /* Keep existing global styles */
  :global(body) {
    margin: 0;
    padding: 0;
    background-color: #222;
    color: #eee;
    overflow: hidden; /* Prevent scrollbars */
    font-family: "Arial", sans-serif;
  }

  main {
    position: relative; /* Needed for absolute positioning of children like visualizer */
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
    background-color: rgba(0, 0, 0, 0.6);
    padding: 20px 40px;
    border-radius: 10px;
    pointer-events: none; /* Allow clicks to pass through */
    font-family: "Helvetica", sans-serif; /* Apply Helvetica font */
  }

  .instructions h1 {
    margin-bottom: 0.5em; /* Add some space below the heading */
    font-size: 4em; /* Make heading larger */
    font-weight: bold;
  }

  .instructions p {
    font-size: 2em; /* Slightly larger paragraph text */
    margin-top: 0;
  }

  /* Remove Instrument Selector styles - they are in the component now */
</style>

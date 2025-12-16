import { writable } from 'svelte/store';
import * as Tone from 'tone';

// Define the ActiveNote interface
export interface ActiveNote {
  id: string | number;
  noteNumber: number;
  velocity: number;
}

// --- Instrument Definitions (Moved here from InstrumentSelector/App) ---
export interface InstrumentOption {
  name: string;
  synthType: typeof Tone.Synth | typeof Tone.FMSynth | typeof Tone.AMSynth | typeof Tone.Sampler | typeof Tone.PluckSynth | typeof Tone.MonoSynth | typeof Tone.DuoSynth | typeof Tone.MetalSynth;
  config: any; // Use 'any' to simplify complex nested configs
}

const casioSamplerConfig: Partial<Tone.SamplerOptions> = {
  urls: { A1: "A1.mp3", A2: "A2.mp3" },
  baseUrl: "https://tonejs.github.io/audio/casio/",
};

const salamanderSamplerConfig: Partial<Tone.SamplerOptions> = {
  urls: {
    A0: "A0.ogg", C1: "C1.ogg", "D#1": "Ds1.ogg", "F#1": "Fs1.ogg", A1: "A1.ogg",
    C2: "C2.ogg", "D#2": "Ds2.ogg", "F#2": "Fs2.ogg", A2: "A2.ogg", C3: "C3.ogg",
    "D#3": "Ds3.ogg", "F#3": "Fs3.ogg", A3: "A3.ogg", C4: "C4.ogg", "D#4": "Ds4.ogg",
    "F#4": "Fs4.ogg", A4: "A4.ogg", C5: "C5.ogg", "D#5": "Ds5.ogg", "F#5": "Fs5.ogg",
    A5: "A5.ogg", C6: "C6.ogg", "D#6": "Ds6.ogg", "F#6": "Fs6.ogg", A6: "A6.ogg",
    C7: "C7.ogg", "D#7": "Ds7.ogg", "F#7": "Fs7.ogg"
  },
  baseUrl: "https://tonejs.github.io/audio/salamander/",
  release: 0.8,
};

// New Sampler Configurations - from nbrosowsky/tonejs-instruments
const guitarAcousticConfig: Partial<Tone.SamplerOptions> = {
  urls: {
    'A2': 'A2.mp3', 'A3': 'A3.mp3', 'A4': 'A4.mp3',
    'A#2': 'As2.mp3', 'A#3': 'As3.mp3', 'A#4': 'As4.mp3',
    'B2': 'B2.mp3', 'B3': 'B3.mp3', 'B4': 'B4.mp3',
    'C3': 'C3.mp3', 'C4': 'C4.mp3', 'C5': 'C5.mp3',
    'C#3': 'Cs3.mp3', 'C#4': 'Cs4.mp3', 'C#5': 'Cs5.mp3',
    'D2': 'D2.mp3', 'D3': 'D3.mp3', 'D4': 'D4.mp3', 'D5': 'D5.mp3',
    'D#2': 'Ds2.mp3', 'D#3': 'Ds3.mp3', 'D#4': 'Ds4.mp3',
    'E2': 'E2.mp3', 'E3': 'E3.mp3', 'E4': 'E4.mp3',
    'F2': 'F2.mp3', 'F3': 'F3.mp3', 'F4': 'F4.mp3',
    'F#2': 'Fs2.mp3', 'F#3': 'Fs3.mp3', 'F#4': 'Fs4.mp3',
    'G2': 'G2.mp3', 'G3': 'G3.mp3', 'G4': 'G4.mp3',
    'G#2': 'Gs2.mp3', 'G#3': 'Gs3.mp3', 'G#4': 'Gs4.mp3'
  },
  baseUrl: "https://nbrosowsky.github.io/tonejs-instruments/samples/guitar-acoustic/",
  release: 1,
};

const guitarElectricConfig: Partial<Tone.SamplerOptions> = {
  urls: {
    'A2': 'A2.mp3', 'A3': 'A3.mp3', 'A4': 'A4.mp3', 'A5': 'A5.mp3',
    'C3': 'C3.mp3', 'C4': 'C4.mp3', 'C5': 'C5.mp3', 'C6': 'C6.mp3',
    'C#2': 'Cs2.mp3',
    'D#3': 'Ds3.mp3', 'D#4': 'Ds4.mp3', 'D#5': 'Ds5.mp3',
    'E2': 'E2.mp3',
    'F#2': 'Fs2.mp3', 'F#3': 'Fs3.mp3', 'F#4': 'Fs4.mp3', 'F#5': 'Fs5.mp3'
  },
  baseUrl: "https://nbrosowsky.github.io/tonejs-instruments/samples/guitar-electric/",
  release: 0.5,
};

const organConfig: Partial<Tone.SamplerOptions> = {
  urls: {
    'C1': 'C1.mp3', 'C2': 'C2.mp3', 'C3': 'C3.mp3', 'C4': 'C4.mp3', 'C5': 'C5.mp3', 'C6': 'C6.mp3',
    'D#1': 'Ds1.mp3', 'D#2': 'Ds2.mp3', 'D#3': 'Ds3.mp3', 'D#4': 'Ds4.mp3', 'D#5': 'Ds5.mp3',
    'F#1': 'Fs1.mp3', 'F#2': 'Fs2.mp3', 'F#3': 'Fs3.mp3', 'F#4': 'Fs4.mp3', 'F#5': 'Fs5.mp3',
    'A1': 'A1.mp3', 'A2': 'A2.mp3', 'A3': 'A3.mp3', 'A4': 'A4.mp3', 'A5': 'A5.mp3'
  },
  baseUrl: "https://nbrosowsky.github.io/tonejs-instruments/samples/organ/",
  release: 0.3,
};

const harmoniumConfig: Partial<Tone.SamplerOptions> = {
  urls: {
    'C2': 'C2.mp3', 'C3': 'C3.mp3', 'C4': 'C4.mp3', 'C5': 'C5.mp3',
    'C#2': 'Cs2.mp3', 'C#3': 'Cs3.mp3', 'C#4': 'Cs4.mp3', 'C#5': 'Cs5.mp3',
    'D2': 'D2.mp3', 'D3': 'D3.mp3', 'D4': 'D4.mp3', 'D5': 'D5.mp3',
    'D#2': 'Ds2.mp3', 'D#3': 'Ds3.mp3', 'D#4': 'Ds4.mp3',
    'E2': 'E2.mp3', 'E3': 'E3.mp3', 'E4': 'E4.mp3',
    'F2': 'F2.mp3', 'F3': 'F3.mp3', 'F4': 'F4.mp3',
    'F#2': 'Fs2.mp3', 'F#3': 'Fs3.mp3',
    'G2': 'G2.mp3', 'G3': 'G3.mp3', 'G4': 'G4.mp3',
    'G#2': 'Gs2.mp3', 'G#3': 'Gs3.mp3', 'G#4': 'Gs4.mp3',
    'A2': 'A2.mp3', 'A3': 'A3.mp3', 'A4': 'A4.mp3',
    'A#2': 'As2.mp3', 'A#3': 'As3.mp3', 'A#4': 'As4.mp3'
  },
  baseUrl: "https://nbrosowsky.github.io/tonejs-instruments/samples/harmonium/",
  release: 0.5,
};

// Export the options array
export const instrumentOptions: InstrumentOption[] = [
  // === SYNTH PRESETS ===
  { name: 'Triangle Wave', synthType: Tone.Synth, config: { oscillator: { type: 'triangle' }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 } } },
  { name: 'Square Wave', synthType: Tone.Synth, config: { oscillator: { type: 'square' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.8 } } },
  { name: 'Sawtooth Wave', synthType: Tone.Synth, config: { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.05, decay: 0.1, sustain: 0.4, release: 1.2 } } },
  { name: 'Simple FM', synthType: Tone.FMSynth, config: { harmonicity: 3, modulationIndex: 10, envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.8 }, modulationEnvelope: { attack: 0.05, decay: 0.1, sustain: 0.3, release: 0.8 } } },

  // === NEW SYNTH PRESETS ===
  { name: 'Plucky', synthType: Tone.PluckSynth, config: { attackNoise: 1, dampening: 4000, resonance: 0.9, release: 1 } },
  { name: 'Deep Bass', synthType: Tone.MonoSynth, config: { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.005, decay: 0.1, sustain: 0.9, release: 0.4 }, filterEnvelope: { attack: 0.06, decay: 0.2, sustain: 0.5, release: 0.3, baseFrequency: 200, octaves: 4 } } },
  { name: 'Ambient Pad', synthType: Tone.DuoSynth, config: { vibratoAmount: 0.5, vibratoRate: 5, harmonicity: 1.5, voice0: { oscillator: { type: 'sine' }, envelope: { attack: 0.8, decay: 0.3, sustain: 0.6, release: 2 } }, voice1: { oscillator: { type: 'triangle' }, envelope: { attack: 1, decay: 0.3, sustain: 0.5, release: 2.5 } } } },
  { name: 'Bell', synthType: Tone.MetalSynth, config: { frequency: 200, envelope: { attack: 0.001, decay: 1.4, release: 0.2 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 } },

  // === SAMPLERS ===
  { name: 'Casio Keyboard', synthType: Tone.Sampler, config: casioSamplerConfig },
  { name: 'Salamander Piano', synthType: Tone.Sampler, config: salamanderSamplerConfig },
  { name: 'Acoustic Guitar', synthType: Tone.Sampler, config: guitarAcousticConfig },
  { name: 'Electric Guitar', synthType: Tone.Sampler, config: guitarElectricConfig },
  { name: 'Organ', synthType: Tone.Sampler, config: organConfig },
  { name: 'Harmonium', synthType: Tone.Sampler, config: harmoniumConfig },
];

// Find the default instrument name
const defaultInstrumentName = instrumentOptions.find((opt: InstrumentOption) => opt.name === 'Salamander Piano')?.name || instrumentOptions[0].name;

// --- Visualizer Definitions ---

// Define the structure for a visualizer option
export interface VisualizerOption {
  name: string;
  // Maybe add component reference later if needed, for now just name
  // component: any; 
}

// Export the available visualizer options
// NOTE: The names here MUST match the component filenames (without .svelte) for dynamic import later
export const visualizerOptions: VisualizerOption[] = [
  { name: 'Ball' }, // Corresponds to BallVisualizer.svelte
  { name: 'Bars' }, // Corresponds to BarsVisualizer.svelte
  { name: 'Particle' }, // Corresponds to ParticleVisualizer.svelte
  { name: 'Circular' }, // Corresponds to CircularVisualizer.svelte
];

// Default visualizer
const defaultVisualizerName = visualizerOptions[0].name; // Default to the first one

// --- Stores ---

// Store for currently active notes
export const activeNotes = writable<Map<string | number, ActiveNote>>(new Map());

// Store for the name of the selected instrument
export const selectedInstrumentName = writable<string>(defaultInstrumentName);

// Store for the name of the selected visualizer
export const selectedVisualizerName = writable<string>(defaultVisualizerName);

// Store for the audio readiness state
export const isAudioReady = writable<boolean>(false);

// Store to hold the synth instance
export const synthInstance = writable<Tone.PolySynth<any> | Tone.Sampler | null>(null);

// Store for Audio Interaction Control
interface AudioControls {
  initAudio: () => Promise<void>;
}
export const audioControls = writable<AudioControls | null>(null);

import { writable, derived } from 'svelte/store';
import * as Tone from 'tone';
import { persisted } from './persist';
import { detectChord } from './chordDetection';

// ============================================================
// Active-note model — single source of truth for visualizers.
// Any input (keyboard, MIDI, FFT, sequencer, demo) pushes into
// `activeNotes` and every visualizer reads from it.
// ============================================================

export interface ActiveNote {
  id: string | number;
  noteNumber: number;
  velocity: number; // 0 - 1
}

export const activeNotes = writable<Map<string | number, ActiveNote>>(new Map());

// ============================================================
// Instruments
// ============================================================

export type SynthFactory = () => Tone.PolySynth<any> | Tone.Sampler;

export interface InstrumentOption {
  name: string;
  category: 'Synth' | 'Sampler';
  factory: SynthFactory;
}

const casioSamplerConfig: Partial<Tone.SamplerOptions> = {
  urls: { A1: 'A1.mp3', A2: 'A2.mp3' },
  baseUrl: 'https://tonejs.github.io/audio/casio/',
};

const salamanderSamplerConfig: Partial<Tone.SamplerOptions> = {
  urls: {
    A0: 'A0.ogg', C1: 'C1.ogg', 'D#1': 'Ds1.ogg', 'F#1': 'Fs1.ogg', A1: 'A1.ogg',
    C2: 'C2.ogg', 'D#2': 'Ds2.ogg', 'F#2': 'Fs2.ogg', A2: 'A2.ogg', C3: 'C3.ogg',
    'D#3': 'Ds3.ogg', 'F#3': 'Fs3.ogg', A3: 'A3.ogg', C4: 'C4.ogg', 'D#4': 'Ds4.ogg',
    'F#4': 'Fs4.ogg', A4: 'A4.ogg', C5: 'C5.ogg', 'D#5': 'Ds5.ogg', 'F#5': 'Fs5.ogg',
    A5: 'A5.ogg', C6: 'C6.ogg', 'D#6': 'Ds6.ogg', 'F#6': 'Fs6.ogg', A6: 'A6.ogg',
    C7: 'C7.ogg', 'D#7': 'Ds7.ogg', 'F#7': 'Fs7.ogg',
  },
  baseUrl: 'https://tonejs.github.io/audio/salamander/',
  release: 0.8,
};

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
    'G#2': 'Gs2.mp3', 'G#3': 'Gs3.mp3', 'G#4': 'Gs4.mp3',
  },
  baseUrl: 'https://nbrosowsky.github.io/tonejs-instruments/samples/guitar-acoustic/',
  release: 1,
};

const guitarElectricConfig: Partial<Tone.SamplerOptions> = {
  urls: {
    'A2': 'A2.mp3', 'A3': 'A3.mp3', 'A4': 'A4.mp3', 'A5': 'A5.mp3',
    'C3': 'C3.mp3', 'C4': 'C4.mp3', 'C5': 'C5.mp3', 'C6': 'C6.mp3',
    'C#2': 'Cs2.mp3',
    'D#3': 'Ds3.mp3', 'D#4': 'Ds4.mp3', 'D#5': 'Ds5.mp3',
    'E2': 'E2.mp3',
    'F#2': 'Fs2.mp3', 'F#3': 'Fs3.mp3', 'F#4': 'Fs4.mp3', 'F#5': 'Fs5.mp3',
  },
  baseUrl: 'https://nbrosowsky.github.io/tonejs-instruments/samples/guitar-electric/',
  release: 0.5,
};

const organConfig: Partial<Tone.SamplerOptions> = {
  urls: {
    'C1': 'C1.mp3', 'C2': 'C2.mp3', 'C3': 'C3.mp3', 'C4': 'C4.mp3', 'C5': 'C5.mp3', 'C6': 'C6.mp3',
    'D#1': 'Ds1.mp3', 'D#2': 'Ds2.mp3', 'D#3': 'Ds3.mp3', 'D#4': 'Ds4.mp3', 'D#5': 'Ds5.mp3',
    'F#1': 'Fs1.mp3', 'F#2': 'Fs2.mp3', 'F#3': 'Fs3.mp3', 'F#4': 'Fs4.mp3', 'F#5': 'Fs5.mp3',
    'A1': 'A1.mp3', 'A2': 'A2.mp3', 'A3': 'A3.mp3', 'A4': 'A4.mp3', 'A5': 'A5.mp3',
  },
  baseUrl: 'https://nbrosowsky.github.io/tonejs-instruments/samples/organ/',
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
    'A#2': 'As2.mp3', 'A#3': 'As3.mp3', 'A#4': 'As4.mp3',
  },
  baseUrl: 'https://nbrosowsky.github.io/tonejs-instruments/samples/harmonium/',
  release: 0.5,
};

// A uniform factory model collapses the old switch-case mess in App.svelte.
export const instrumentOptions: InstrumentOption[] = [
  { name: 'Triangle Wave', category: 'Synth', factory: () => new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 } }) },
  { name: 'Square Wave',   category: 'Synth', factory: () => new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'square'   }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.8 } }) },
  { name: 'Sawtooth Wave', category: 'Synth', factory: () => new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.05, decay: 0.1, sustain: 0.4, release: 1.2 } }) },
  { name: 'Simple FM',     category: 'Synth', factory: () => new Tone.PolySynth(Tone.FMSynth, { harmonicity: 3, modulationIndex: 10, envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.8 }, modulationEnvelope: { attack: 0.05, decay: 0.1, sustain: 0.3, release: 0.8 } }) },
  { name: 'Plucky',        category: 'Synth', factory: () => new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.4 } }) },
  { name: 'Deep Bass',     category: 'Synth', factory: () => new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.005, decay: 0.1, sustain: 0.9, release: 0.4 } }) },
  { name: 'Ambient Pad',   category: 'Synth', factory: () => new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.8, decay: 0.3, sustain: 0.6, release: 2 } }) },
  { name: 'Bell',          category: 'Synth', factory: () => new Tone.PolySynth(Tone.FMSynth, { harmonicity: 8, modulationIndex: 20, envelope: { attack: 0.001, decay: 1.2, sustain: 0, release: 0.3 } }) },
  { name: 'Casio Keyboard',   category: 'Sampler', factory: () => new Tone.Sampler(casioSamplerConfig) },
  { name: 'Salamander Piano', category: 'Sampler', factory: () => new Tone.Sampler(salamanderSamplerConfig) },
  { name: 'Acoustic Guitar',  category: 'Sampler', factory: () => new Tone.Sampler(guitarAcousticConfig) },
  { name: 'Electric Guitar',  category: 'Sampler', factory: () => new Tone.Sampler(guitarElectricConfig) },
  { name: 'Organ',            category: 'Sampler', factory: () => new Tone.Sampler(organConfig) },
  { name: 'Harmonium',        category: 'Sampler', factory: () => new Tone.Sampler(harmoniumConfig) },
];

const defaultInstrumentName = 'Salamander Piano';

// ============================================================
// Visualizers
// ============================================================

export interface VisualizerOption {
  name: string;
  label: string;
  description: string;
}

export const visualizerOptions: VisualizerOption[] = [
  { name: 'Ball',         label: 'Orbs',          description: 'Soft glowing orbs placed by pitch' },
  { name: 'Bars',         label: 'Bars',          description: 'Expanding time-bars, DAW style' },
  { name: 'RadialBars',   label: 'Radial Bars',   description: 'Time-bars radiating from a central point' },
  { name: 'Particle',     label: 'Particles',     description: 'Fireworks bursting per note' },
  { name: 'Circular',     label: 'Wheel',         description: 'Chromatic circle with chord glow' },
  { name: 'PianoRoll',    label: 'Piano Roll',    description: 'Scrolling colored notes over time' },
  { name: 'HarmonicWheel',label: 'Tonnetz',       description: 'Circle of fifths + chord readout' },
  { name: 'Spectrogram',  label: 'Spectrogram',   description: 'Rolling FFT heatmap in note colors' },
  { name: 'Painting',     label: 'Painting',      description: 'Cumulative brushstrokes on canvas' },
  { name: 'Shader',       label: 'Shader',        description: 'GLSL flow field driven by notes' },
  { name: 'Starfield',    label: 'Constellation', description: 'Stars spawn and link as chords' },
  { name: 'Keys',         label: 'Keys',          description: 'On-screen piano lit by color' },
];

const defaultVisualizerName = 'Ball';

// ============================================================
// Persisted UI / settings
// ============================================================

export const selectedInstrumentName = persisted<string>('instrument', defaultInstrumentName);
export const selectedVisualizerName = persisted<string>('visualizer', defaultVisualizerName);
export const selectedTheme = persisted<string>('theme', 'default');

export const keyboardOctaveOffset = persisted<number>('kbOctave', 0);

export const masterVolume = persisted<number>('masterVolume', 80);  // 0-100
export const reverbAmount = persisted<number>('reverbAmount', 15);  // 0-100 wet %
export const delayAmount  = persisted<number>('delayAmount',  0);   // 0-100 wet %
export const chorusAmount = persisted<number>('chorusAmount', 0);   // 0-100 wet %
export const masterMuted  = persisted<boolean>('masterMuted', false);

export const selectedMidiInputId = persisted<string>('midiInputId', 'all');

export const isPanelCollapsed = persisted<boolean>('panelCollapsed', false);
export const onscreenPianoVisible = persisted<boolean>('onscreenPiano', false);

export const helpOverlayVisible = writable<boolean>(false);

// Runtime-only
export const isAudioReady      = writable<boolean>(false);
export const isLoadingSynth    = writable<boolean>(false);
export const audioUnlockBlocked = writable<boolean>(false); // Firefox / autoplay hint
export const synthInstance     = writable<Tone.PolySynth<any> | Tone.Sampler | null>(null);
export const sustainPedalDown  = writable<boolean>(false);
export const pitchBend         = writable<number>(0); // -1..1
export const modWheel          = writable<number>(0); //  0..1
export const midiInputs        = writable<{ id: string; name: string; state: string }[]>([]);
export const midiStatus        = writable<'unsupported' | 'unavailable' | 'ready'>('unavailable');

// Live chord readout derived from active notes.
export const currentChord = derived(activeNotes, ($notes) => {
  const list = [...$notes.values()].map((n) => n.noteNumber);
  return detectChord(list);
});

// ============================================================
// Audio control bridge
// ============================================================

interface AudioControls {
  initAudio: () => Promise<void>;
}
export const audioControls = writable<AudioControls | null>(null);

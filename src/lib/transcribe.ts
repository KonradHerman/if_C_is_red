/**
 * Offline note transcription for dropped audio files, via Spotify's Basic
 * Pitch (Apache 2.0, ~900KB model, runs locally — no audio leaves the page).
 *
 * The app has the whole file the moment it is dropped, so there is no reason
 * to guess at notes from a sliding FFT window while the audio plays. Analysing
 * the file up front removes every constraint the real-time path fought:
 * no latency/resolution tradeoff, and — because the model has a dedicated
 * onset head — a note struck again while still ringing reads as a new note,
 * which pitch-tracking alone can never see.
 *
 * TensorFlow.js is far larger than the rest of the bundle, so everything here
 * is behind a dynamic import and costs nothing until a file is actually
 * dropped in.
 */

export interface TranscribedNote {
  note: number;      // MIDI note number
  start: number;     // seconds from the start of the file
  duration: number;  // seconds
  velocity: number;  // 0-1
}

/** Sample rate the Basic Pitch model expects. */
const MODEL_SAMPLE_RATE = 22050;

function modelUrl(): string {
  // Resolved against the document base so it survives the relative-base
  // ('./') build used for GitHub Pages.
  return new URL('basic-pitch-model/model.json', document.baseURI).href;
}

/** Decode to mono at the model's sample rate. */
async function toModelPcm(file: File): Promise<Float32Array> {
  const bytes = await file.arrayBuffer();

  const DecodeCtx = window.AudioContext ?? (window as any).webkitAudioContext;
  const decodeCtx: AudioContext = new DecodeCtx();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(bytes);
  } finally {
    void decodeCtx.close();
  }

  const frames = Math.max(1, Math.ceil(decoded.duration * MODEL_SAMPLE_RATE));
  const offline = new OfflineAudioContext(1, frames, MODEL_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

/**
 * Transcribe a file to a list of notes. `onProgress` receives 0..1.
 * Throws if the model cannot be loaded or inference fails; callers should fall
 * back to the live analyser path.
 */
export async function transcribeFile(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<TranscribedNote[]> {
  const pcm = await toModelPcm(file);
  onProgress?.(0);

  // Basic Pitch bundles its own TensorFlow.js; handing it the URL rather than
  // a pre-loaded model keeps this file free of a direct tfjs dependency (and
  // of the duplicate-copy problem that comes with pinning a second version).
  const { BasicPitch, outputToNotesPoly, noteFramesToTime } = await import('@spotify/basic-pitch');

  const basicPitch = new BasicPitch(modelUrl());

  const frames: number[][] = [];
  const onsets: number[][] = [];
  const contours: number[][] = [];

  await basicPitch.evaluateModel(
    pcm,
    (f, o, c) => { frames.push(...f); onsets.push(...o); contours.push(...c); },
    (p) => onProgress?.(p),
  );

  // onsetThresh / frameThresh / minNoteLen: the defaults are tuned for
  // transcription-to-MIDI. A visualizer would rather miss a marginal note than
  // flash one, so the onset threshold stays strict and very short notes are
  // dropped (11 frames ~= 128ms).
  const notes = noteFramesToTime(outputToNotesPoly(frames, onsets, 0.5, 0.3, 11));

  return notes
    .map((n) => ({
      note: n.pitchMidi,
      start: n.startTimeSeconds,
      duration: n.durationSeconds,
      velocity: Math.min(1, Math.max(0.15, n.amplitude)),
    }))
    .sort((a, b) => a.start - b.start);
}

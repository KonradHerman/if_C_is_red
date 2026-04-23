import * as Tone from 'tone';
import { get } from 'svelte/store';
import { masterVolume, reverbAmount, delayAmount, chorusAmount, masterMuted } from './stores';

/**
 * Audio chain: synth -> chainInput -> [FX] -> masterGain -> destination
 *
 * The two gain nodes are constructed eagerly — plain Gain nodes are safe to
 * create on a suspended AudioContext in every browser. They're wired bypass
 * on boot, so synths and samples routed through them produce audio the
 * instant Tone.start() resumes the context.
 *
 * The effects (Chorus / FeedbackDelay / Reverb) are deferred to ensureEffects(),
 * which must be called after a user gesture. This matters in Firefox: its
 * autoplay policy can cause Tone.Reverb's internal OfflineAudioContext
 * rendering and Tone.Chorus's LFO start() to fail when invoked before any
 * gesture has unlocked audio. Each effect node is guarded so a single
 * failure never breaks the whole chain.
 */

let chainInput: Tone.Gain | null = null;
let masterGain: Tone.Gain | null = null;

let chorus: Tone.Chorus | null = null;
let delay:  Tone.FeedbackDelay | null = null;
let reverb: Tone.Reverb | null = null;

let fxInitialized = false;

function ensureBase(): { input: Tone.Gain; master: Tone.Gain } {
  if (!chainInput || !masterGain) {
    chainInput = new Tone.Gain(1);
    masterGain = new Tone.Gain(0.8);
    chainInput.connect(masterGain);
    masterGain.toDestination();

    // Subscribe once - safe to do before gesture because rampTo on a Gain
    // Signal is purely a scheduling primitive, not audio playback.
    masterVolume.subscribe(applyVolume);
    masterMuted.subscribe(applyVolume);
    reverbAmount.subscribe((v) => { if (reverb)  reverb.wet.rampTo(v / 100, 0.05); });
    delayAmount .subscribe((v) => { if (delay)   delay.wet.rampTo(v / 100, 0.05);  });
    chorusAmount.subscribe((v) => { if (chorus)  chorus.wet.rampTo(v / 100, 0.05); });
  }
  return { input: chainInput, master: masterGain };
}

export function getChainInput(): Tone.Gain {
  return ensureBase().input;
}

export function getChainOutput(): Tone.Gain {
  return ensureBase().master;
}

/**
 * Insert the effect nodes between chainInput and masterGain. Safe to call
 * multiple times; only the first successful call actually builds the FX.
 * Call from within the user-gesture flow (e.g. initAudio after Tone.start).
 */
export function ensureEffects(): void {
  if (fxInitialized) return;
  const { input, master } = ensureBase();

  // Build each effect independently. A failure in one must not block the
  // others, and must not tear down the already-working direct bypass.
  const built: Tone.ToneAudioNode[] = [];

  try {
    chorus = new Tone.Chorus({ frequency: 2, depth: 0.5, wet: 0 }).start();
    chorus.wet.value = get(chorusAmount) / 100;
    built.push(chorus);
  } catch (e) {
    console.warn('audioChain: Chorus construction failed; skipping.', e);
    chorus = null;
  }

  try {
    delay = new Tone.FeedbackDelay({ delayTime: 0.25, feedback: 0.35, wet: 0 });
    delay.wet.value = get(delayAmount) / 100;
    built.push(delay);
  } catch (e) {
    console.warn('audioChain: FeedbackDelay construction failed; skipping.', e);
    delay = null;
  }

  try {
    reverb = new Tone.Reverb({ decay: 3, wet: 0 });
    reverb.wet.value = get(reverbAmount) / 100;
    built.push(reverb);
  } catch (e) {
    console.warn('audioChain: Reverb construction failed; skipping.', e);
    reverb = null;
  }

  if (built.length === 0) {
    fxInitialized = true; // No FX available - stay in bypass mode.
    return;
  }

  // Rewire: input -> fx[0] -> fx[1] -> ... -> master
  try {
    input.disconnect();
    let prev: Tone.ToneAudioNode = input;
    for (const node of built) {
      prev.connect(node);
      prev = node;
    }
    prev.connect(master);
  } catch (e) {
    // If rewiring somehow blew up, restore the bypass and dispose the
    // half-inserted effects so audio keeps flowing.
    console.warn('audioChain: FX rewire failed; reverting to bypass.', e);
    try { input.disconnect(); } catch { /* ignore */ }
    input.connect(master);
    built.forEach((n) => { try { n.dispose(); } catch { /* ignore */ } });
    chorus = delay = reverb = null;
  }

  fxInitialized = true;
}

function applyVolume() {
  if (!masterGain) return;
  const muted = get(masterMuted);
  const vol = get(masterVolume);
  masterGain.gain.rampTo(muted ? 0 : Math.pow(vol / 100, 2), 0.05);
}

export function disposeChain() {
  chorus?.dispose();
  delay?.dispose();
  reverb?.dispose();
  masterGain?.dispose();
  chainInput?.dispose();
  chorus = delay = reverb = masterGain = chainInput = null;
  fxInitialized = false;
}

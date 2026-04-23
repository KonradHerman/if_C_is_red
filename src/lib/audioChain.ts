import * as Tone from 'tone';
import { get } from 'svelte/store';
import { masterVolume, reverbAmount, delayAmount, chorusAmount, masterMuted } from './stores';

/**
 * A single shared output chain: synth -> chorus -> delay -> reverb -> gain -> destination.
 * Any active Tone source connects to `chainInput`. All controls (volume, FX mix,
 * mute) read from the persisted stores so the wiring only happens once.
 */

let chainInput: Tone.Gain | null = null;
let chorus: Tone.Chorus | null = null;
let delay: Tone.FeedbackDelay | null = null;
let reverb: Tone.Reverb | null = null;
let masterGain: Tone.Gain | null = null;

let initialized = false;

export function getChainInput(): Tone.Gain {
  ensure();
  return chainInput!;
}

export function getChainOutput(): Tone.Gain {
  ensure();
  return masterGain!;
}

function ensure() {
  if (initialized) return;

  chainInput  = new Tone.Gain(1);
  chorus      = new Tone.Chorus({ frequency: 2, depth: 0.5, wet: 0 }).start();
  delay       = new Tone.FeedbackDelay({ delayTime: 0.25, feedback: 0.35, wet: 0 });
  reverb      = new Tone.Reverb({ decay: 3, wet: 0.15 });
  masterGain  = new Tone.Gain(0.8);

  chainInput.connect(chorus);
  chorus.connect(delay);
  delay.connect(reverb);
  reverb.connect(masterGain);
  masterGain.toDestination();

  // Subscribe to persisted stores.
  masterVolume.subscribe(applyVolume);
  masterMuted.subscribe(applyVolume);
  reverbAmount.subscribe((v) => { if (reverb)  reverb.wet.rampTo(v / 100, 0.05); });
  delayAmount .subscribe((v) => { if (delay)   delay.wet.rampTo(v / 100, 0.05);  });
  chorusAmount.subscribe((v) => { if (chorus)  chorus.wet.rampTo(v / 100, 0.05); });

  initialized = true;
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
  initialized = false;
}

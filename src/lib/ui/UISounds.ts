// UI Sound Effects Manager
// Generates simple synth sounds for tactile feedback

import * as Tone from 'tone';

// Cached synth instances for UI sounds
let uiSynth: Tone.Synth | null = null;
let noiseSynth: Tone.NoiseSynth | null = null;
let isInitialized = false;

// Volume for UI sounds (can be adjusted later via settings)
let uiVolume = -20; // dB

// Initialize synths lazily (only when first sound is played)
function ensureInitialized() {
    if (isInitialized) return;

    uiSynth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: {
            attack: 0.001,
            decay: 0.05,
            sustain: 0,
            release: 0.05
        }
    }).toDestination();
    uiSynth.volume.value = uiVolume;

    noiseSynth = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: {
            attack: 0.001,
            decay: 0.02,
            sustain: 0,
            release: 0.02
        }
    }).toDestination();
    noiseSynth.volume.value = uiVolume - 10;

    isInitialized = true;
}

export type UISoundType = 'click' | 'switch' | 'knob' | 'hover' | 'error' | 'success' | 'record';

export function playUISound(type: UISoundType): void {
    // Don't play if audio context isn't started
    if (Tone.context.state !== 'running') return;

    ensureInitialized();
    if (!uiSynth || !noiseSynth) return;

    const now = Tone.now();

    switch (type) {
        case 'click':
            // Short, crisp click
            uiSynth.triggerAttackRelease('C6', '32n', now);
            break;

        case 'switch':
            // Toggle switch sound - two quick tones
            uiSynth.triggerAttackRelease('G5', '64n', now);
            uiSynth.triggerAttackRelease('C6', '64n', now + 0.03);
            break;

        case 'knob':
            // Subtle tick for knob rotation
            uiSynth.volume.value = uiVolume - 15;
            uiSynth.triggerAttackRelease('A5', '128n', now);
            uiSynth.volume.value = uiVolume;
            break;

        case 'hover':
            // Very subtle hover feedback
            uiSynth.volume.value = uiVolume - 20;
            uiSynth.triggerAttackRelease('E5', '128n', now);
            uiSynth.volume.value = uiVolume;
            break;

        case 'error':
            // Error buzz
            uiSynth.triggerAttackRelease('E3', '16n', now);
            uiSynth.triggerAttackRelease('Eb3', '16n', now + 0.08);
            break;

        case 'success':
            // Happy ascending ding
            uiSynth.triggerAttackRelease('C5', '32n', now);
            uiSynth.triggerAttackRelease('E5', '32n', now + 0.06);
            uiSynth.triggerAttackRelease('G5', '32n', now + 0.12);
            break;

        case 'record':
            // Recording start beep
            uiSynth.triggerAttackRelease('A5', '16n', now);
            noiseSynth.triggerAttackRelease('32n', now);
            break;
    }
}

export function setUIVolume(volume: number): void {
    uiVolume = volume;
    if (uiSynth) uiSynth.volume.value = volume;
    if (noiseSynth) noiseSynth.volume.value = volume - 10;
}

export function getUIVolume(): number {
    return uiVolume;
}

// Cleanup function for when app unmounts
export function disposeUISounds(): void {
    if (uiSynth) {
        uiSynth.dispose();
        uiSynth = null;
    }
    if (noiseSynth) {
        noiseSynth.dispose();
        noiseSynth = null;
    }
    isInitialized = false;
}

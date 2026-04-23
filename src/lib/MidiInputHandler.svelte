<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import {
    activeNotes as activeNotesStore,
    synthInstance,
    isAudioReady as isAudioReadyStore,
    audioControls,
    sustainPedalDown,
    pitchBend,
    modWheel,
    midiInputs,
    midiStatus,
    selectedMidiInputId,
  } from './stores';
  import * as Tone from 'tone';

  let midiAccess: WebMidi.MIDIAccess | null = null;
  const activeMidiNotes = new Set<number>();
  const sustainedOnRelease = new Set<number>();

  async function handleMIDIMessage(message: WebMidi.MIDIMessageEvent) {
    const selected = get(selectedMidiInputId);
    const srcId = (message.currentTarget as WebMidi.MIDIInput | null)?.id;
    if (selected !== 'all' && srcId && srcId !== selected) return;

    if (!get(isAudioReadyStore)) {
      const controls = get(audioControls);
      if (controls?.initAudio) {
        try { await controls.initAudio(); } catch { return; }
      }
      if (!get(isAudioReadyStore)) return;
    }
    processMidiEvent(message);
  }

  function processMidiEvent(message: WebMidi.MIDIMessageEvent) {
    const synth = get(synthInstance);
    if (!synth || (synth instanceof Tone.Sampler && !synth.loaded)) return;

    const data = message.data;
    const status = data[0] & 0xf0;
    const d1 = data[1];
    const d2 = data.length > 2 ? data[2] : 0;

    if (status === 0x90 && d2 > 0) {
      // Note on
      const name = Tone.Frequency(d1, 'midi').toNote();
      const velocity = d2 / 127;
      activeMidiNotes.add(d1);
      sustainedOnRelease.delete(d1);
      synth.triggerAttack(name, Tone.now(), velocity);
      activeNotesStore.update((m) => {
        m.set(d1, { id: d1, noteNumber: d1, velocity });
        return m;
      });
    } else if (status === 0x80 || (status === 0x90 && d2 === 0)) {
      // Note off
      const name = Tone.Frequency(d1, 'midi').toNote();
      activeMidiNotes.delete(d1);
      if (get(sustainPedalDown)) {
        sustainedOnRelease.add(d1);
        return;
      }
      synth.triggerRelease(name, Tone.now());
      activeNotesStore.update((m) => { m.delete(d1); return m; });
    } else if (status === 0xb0) {
      // Control change
      if (d1 === 64) {
        const down = d2 >= 64;
        sustainPedalDown.set(down);
      } else if (d1 === 1) {
        modWheel.set(d2 / 127);
      }
    } else if (status === 0xe0) {
      // Pitch bend
      const val = ((d2 << 7) | d1) - 8192;
      pitchBend.set(val / 8192);
    }
  }

  sustainPedalDown.subscribe((down) => {
    if (down) return;
    if (sustainedOnRelease.size === 0) return;
    const synth = get(synthInstance);
    sustainedOnRelease.forEach((note) => {
      const name = Tone.Frequency(note, 'midi').toNote();
      synth?.triggerRelease(name, Tone.now());
      activeNotesStore.update((m) => { m.delete(note); return m; });
    });
    sustainedOnRelease.clear();
  });

  function refreshInputList() {
    if (!midiAccess) return;
    const list: { id: string; name: string; state: string }[] = [];
    midiAccess.inputs.forEach((input) => {
      list.push({ id: input.id, name: input.name ?? 'Unknown', state: input.state });
    });
    midiInputs.set(list);
  }

  function onMIDISuccess(access: WebMidi.MIDIAccess) {
    midiAccess = access;
    midiStatus.set('ready');

    for (const input of midiAccess.inputs.values()) {
      input.onmidimessage = null;
    }
    for (const input of midiAccess.inputs.values()) {
      input.onmidimessage = handleMIDIMessage;
    }

    refreshInputList();

    midiAccess.onstatechange = (event: WebMidi.MIDIConnectionEvent) => {
      if (event.port.type === 'input') {
        if (event.port.state === 'connected' && 'onmidimessage' in event.port) {
          (event.port as WebMidi.MIDIInput).onmidimessage = handleMIDIMessage;
        } else if (event.port.state === 'disconnected' && 'onmidimessage' in event.port) {
          (event.port as WebMidi.MIDIInput).onmidimessage = null;
        }
      }
      refreshInputList();
    };
  }

  function onMIDIFailure() {
    midiStatus.set('unavailable');
  }

  onMount(() => {
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure).catch(onMIDIFailure);
    } else {
      midiStatus.set('unsupported');
    }

    return () => {
      if (midiAccess) {
        midiAccess.onstatechange = null;
        for (const input of midiAccess.inputs.values()) {
          if (input && 'onmidimessage' in input) input.onmidimessage = null;
        }
        midiAccess = null;
      }
    };
  });
</script>

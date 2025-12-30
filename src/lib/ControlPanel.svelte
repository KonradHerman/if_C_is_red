<script lang="ts">
    import {
        selectedInstrumentName,
        instrumentOptions,
        selectedVisualizerName,
        visualizerOptions,
        isAudioReady,
    } from "./stores";
    import { playUISound } from "./ui/UISounds";
    import * as Tone from "tone";

    // Audio file input state
    let audioFile: File | null = null;
    let audioPlayer: Tone.Player | null = null;
    let analyser: Tone.Analyser | null = null;
    let isPlaying = false;
    let isAnalyzing = false;
    let dragOver = false;
    let analysisLoop: number | null = null;

    // Theme state
    let currentTheme = "default";
    const themes = [
        { id: "default", name: "Dark Matter" },
        { id: "vintage", name: "Vintage Wood" },
        { id: "industrial", name: "Industrial" },
    ];

    function handleThemeChange(e: Event) {
        const target = e.target as HTMLSelectElement;
        currentTheme = target.value;
        document.body.dataset.theme = currentTheme;
        playUISound("switch");
    }

    // For note detection from FFT
    import { activeNotes as activeNotesStore } from "./stores";

    function handleInstrumentChange(e: Event) {
        const target = e.target as HTMLSelectElement;
        selectedInstrumentName.set(target.value);
        playUISound("click");
    }

    function handleVisualizerChange(e: Event) {
        const target = e.target as HTMLSelectElement;
        selectedVisualizerName.set(target.value);
        playUISound("click");
    }

    // ===== Audio File Handling =====
    function handleFileDrop(e: DragEvent) {
        e.preventDefault();
        dragOver = false;

        const file = e.dataTransfer?.files[0];
        if (file && file.type.startsWith("audio/")) {
            loadAudioFile(file);
        }
    }

    function handleFileSelect(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (file) {
            loadAudioFile(file);
        }
    }

    async function loadAudioFile(file: File) {
        audioFile = file;
        playUISound("success");

        // Clean up previous player
        if (audioPlayer) {
            audioPlayer.stop();
            audioPlayer.dispose();
        }

        // Create URL and load audio
        const url = URL.createObjectURL(file);

        // Initialize analyser for FFT
        analyser = new Tone.Analyser("fft", 2048);

        audioPlayer = new Tone.Player({
            url,
            onload: () => {
                console.log("Audio file loaded:", file.name);
            },
            // Callback when playback stops (either manually or end of file)
            onstop: () => {
                console.log("Playback stopped");
                isPlaying = false;
                stopAnalysis();
            },
        });

        audioPlayer.connect(analyser);
        audioPlayer.toDestination();

        await Tone.loaded();
    }

    async function togglePlayback() {
        if (!audioPlayer) return;

        await Tone.start();

        if (isPlaying) {
            audioPlayer.stop();
            // State update handled by onstop callback
        } else {
            audioPlayer.start();
            isPlaying = true;
            startAnalysis();
        }
        playUISound("switch");
    }

    function startAnalysis() {
        if (!analyser) return;
        isAnalyzing = true;

        const analyze = () => {
            if (!isAnalyzing || !analyser) return;

            const fftData = analyser.getValue() as Float32Array;
            const detectedNotes = detectPeaks(fftData);

            // Update activeNotes store with detected notes
            activeNotesStore.update((notes) => {
                // Clear old analyzed notes (IDs starting with 'fft-')
                const newNotes = new Map(
                    [...notes].filter(([id]) => !String(id).startsWith("fft-")),
                );

                // Add detected notes
                detectedNotes.forEach((noteNum, idx) => {
                    newNotes.set(`fft-${noteNum}`, {
                        id: `fft-${noteNum}`,
                        noteNumber: noteNum,
                        velocity: 0.7, // Fixed velocity for analyzed notes
                    });
                });

                return newNotes;
            });

            analysisLoop = requestAnimationFrame(analyze);
        };

        analysisLoop = requestAnimationFrame(analyze);
    }

    function stopAnalysis() {
        isAnalyzing = false;
        if (analysisLoop) {
            cancelAnimationFrame(analysisLoop);
            analysisLoop = null;
        }

        // Clear analyzed notes
        activeNotesStore.update((notes) => {
            return new Map(
                [...notes].filter(([id]) => !String(id).startsWith("fft-")),
            );
        });
    }

    function detectPeaks(fftData: Float32Array, threshold = -60): number[] {
        const peaks: { note: number; amplitude: number }[] = [];
        const sampleRate = Tone.context.sampleRate;
        const binSize = sampleRate / 2048;

        for (let i = 2; i < fftData.length - 2; i++) {
            const val = fftData[i];
            // Check if this is a local maximum
            if (
                val > threshold &&
                val > fftData[i - 1] &&
                val > fftData[i - 2] &&
                val > fftData[i + 1] &&
                val > fftData[i + 2]
            ) {
                const freq = i * binSize;
                // Expanded musical frequency range (roughly C0 to C8)
                if (freq > 20 && freq < 4200) {
                    const midiNote = Math.round(
                        12 * Math.log2(freq / 440) + 69,
                    );
                    if (midiNote >= 21 && midiNote <= 108) {
                        peaks.push({ note: midiNote, amplitude: val });
                    }
                }
            }
        }

        // Sort by amplitude (strongest first) and return unique notes, max 12
        peaks.sort((a, b) => b.amplitude - a.amplitude);
        const uniqueNotes = new Set<number>();
        const result: number[] = [];
        for (const peak of peaks) {
            if (!uniqueNotes.has(peak.note) && result.length < 12) {
                uniqueNotes.add(peak.note);
                result.push(peak.note);
            }
        }
        return result;
    }

    function clearAudioFile() {
        if (audioPlayer) {
            audioPlayer.stop();
            audioPlayer.dispose();
            audioPlayer = null;
        }
        if (analyser) {
            analyser.dispose();
            analyser = null;
        }
        stopAnalysis();
        audioFile = null;
        isPlaying = false;
    }
</script>

<div class="control-panel">
    <!-- Header with LED -->
    <div class="panel-header">
        <div class="header-left">
            <div class="led" class:on={$isAudioReady}></div>
            <h2 class="panel-title">If C Is Red</h2>
        </div>

        <!-- Theme Selector (Small) -->
        <div class="theme-selector-wrapper">
            <select
                class="theme-select"
                value={currentTheme}
                on:change={handleThemeChange}
                aria-label="Theme"
            >
                {#each themes as theme}
                    <option value={theme.id}>{theme.name}</option>
                {/each}
            </select>
        </div>
    </div>

    <div class="panel-divider"></div>

    <!-- Instrument Selector -->
    <div class="control-group">
        <label class="control-label" for="instrument-select">Instrument</label>
        <select
            id="instrument-select"
            class="synth-select"
            value={$selectedInstrumentName}
            on:change={handleInstrumentChange}
        >
            {#each instrumentOptions as option (option.name)}
                <option value={option.name}>{option.name}</option>
            {/each}
        </select>
    </div>

    <!-- Visualizer Selector -->
    <div class="control-group">
        <label class="control-label" for="visualizer-select">Visualizer</label>
        <select
            id="visualizer-select"
            class="synth-select"
            value={$selectedVisualizerName}
            on:change={handleVisualizerChange}
        >
            {#each visualizerOptions as option (option.name)}
                <option value={option.name}>{option.name}</option>
            {/each}
        </select>
    </div>

    <div class="panel-divider"></div>

    <!-- Audio File Input -->
    <div class="control-group">
        <label class="control-label">Audio Input</label>

        {#if !audioFile}
            <div
                class="file-drop-zone"
                class:drag-over={dragOver}
                on:dragover|preventDefault={() => (dragOver = true)}
                on:dragleave={() => (dragOver = false)}
                on:drop={handleFileDrop}
                role="button"
                tabindex="0"
            >
                <input
                    type="file"
                    accept="audio/*"
                    on:change={handleFileSelect}
                    id="audio-file-input"
                    class="file-input"
                />
                <label for="audio-file-input" class="file-label">
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span>Drop audio or click</span>
                </label>
            </div>
        {:else}
            <div class="audio-controls">
                <span class="file-name"
                    >{audioFile.name.slice(0, 18)}{audioFile.name.length > 18
                        ? "..."
                        : ""}</span
                >
                <div class="audio-buttons">
                    <button
                        class="play-btn"
                        class:playing={isPlaying}
                        on:click={togglePlayback}
                        aria-label={isPlaying ? "Stop" : "Play"}
                    >
                        {#if isPlaying}
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                            >
                                <rect x="6" y="4" width="4" height="16" />
                                <rect x="14" y="4" width="4" height="16" />
                            </svg>
                        {:else}
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                            >
                                <polygon points="5,3 19,12 5,21" />
                            </svg>
                        {/if}
                    </button>
                    <button
                        class="clear-btn"
                        on:click={clearAudioFile}
                        aria-label="Remove file"
                    >
                        <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            </div>
        {/if}
    </div>

    {#if isAnalyzing}
        <div class="analyzing-indicator">
            <div class="analyzing-dot"></div>
            <span>Analyzing...</span>
        </div>
    {/if}
</div>

<style>
    .control-panel {
        position: fixed;
        top: 16px;
        left: 16px;
        z-index: 100;

        background: linear-gradient(
            180deg,
            var(--synth-panel-light, #2d2d3d) 0%,
            var(--synth-panel, #252532) 100%
        );
        border: 1px solid var(--synth-border, rgba(255, 255, 255, 0.08));
        border-radius: var(--synth-radius-md, 12px);
        box-shadow:
            0 4px 24px var(--synth-shadow-color, rgba(0, 0, 0, 0.6)),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);

        padding: 16px;
        min-width: 220px;

        font-family: var(--synth-font-display, "Inter", sans-serif);
    }

    .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
    }

    .header-left {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .led {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #333;
        box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.5);
        transition: all 0.2s ease;
    }

    .led.on {
        background: var(--synth-accent-green, #4ade80);
        box-shadow:
            0 0 8px var(--synth-accent-green, #4ade80),
            0 0 16px rgba(74, 222, 128, 0.5);
    }

    .panel-title {
        font-family: var(--synth-font-mono, monospace);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        color: var(--synth-label, #888);
        margin: 0;
    }

    /* Theme Selector */
    .theme-select {
        background: transparent;
        border: none;
        color: var(--synth-label, #888);
        font-family: var(--synth-font-mono, monospace);
        font-size: 10px;
        text-transform: uppercase;
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.2s;
    }

    .theme-select:hover {
        opacity: 1;
        color: var(--synth-text, #fff);
    }

    .theme-select:focus {
        outline: none;
    }

    .panel-divider {
        height: 1px;
        background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.1),
            transparent
        );
        margin: 12px 0;
    }

    .control-group {
        margin-bottom: 12px;
    }

    .control-label {
        display: block;
        font-family: var(--synth-font-mono, monospace);
        font-size: 9px;
        font-weight: 600;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: var(--synth-label, #6b6b78);
        margin-bottom: 6px;
    }

    .synth-select {
        width: 100%;
        font-family: var(--synth-font-mono, monospace);
        font-size: 12px;
        color: var(--synth-text, #e0e0e8);
        background: var(--synth-bg, #1a1a24);
        border: 1px solid var(--synth-border-light, rgba(255, 255, 255, 0.12));
        border-radius: var(--synth-radius-sm, 6px);
        padding: 8px 32px 8px 12px;
        cursor: pointer;
        box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 10px center;
        transition: all 0.15s ease;
    }

    .synth-select:hover {
        border-color: var(--synth-accent, #ff6b6b);
    }

    .synth-select:focus {
        outline: none;
        border-color: var(--synth-accent, #ff6b6b);
        box-shadow:
            inset 0 2px 4px rgba(0, 0, 0, 0.4),
            0 0 0 2px rgba(255, 107, 107, 0.2);
    }

    /* File Drop Zone */
    .file-drop-zone {
        position: relative;
        border: 2px dashed var(--synth-border-light, rgba(255, 255, 255, 0.15));
        border-radius: var(--synth-radius-md, 8px);
        padding: 16px;
        text-align: center;
        transition: all 0.2s ease;
        background: rgba(0, 0, 0, 0.2);
    }

    .file-drop-zone:hover,
    .file-drop-zone.drag-over {
        border-color: var(--synth-accent, #ff6b6b);
        background: rgba(255, 107, 107, 0.05);
    }

    .file-input {
        position: absolute;
        inset: 0;
        opacity: 0;
        cursor: pointer;
    }

    .file-label {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        color: var(--synth-label, #888);
        font-size: 11px;
        pointer-events: none;
    }

    .file-label svg {
        opacity: 0.6;
    }

    /* Audio Controls */
    .audio-controls {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: rgba(0, 0, 0, 0.3);
        border-radius: var(--synth-radius-sm, 8px);
        padding: 8px 12px;
    }

    .file-name {
        font-family: var(--synth-font-mono, monospace);
        font-size: 11px;
        color: var(--synth-text-dim, #aaa);
    }

    .audio-buttons {
        display: flex;
        gap: 6px;
    }

    .play-btn,
    .clear-btn {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
    }

    .play-btn {
        background: var(--synth-accent, #ff6b6b);
        color: #fff;
    }

    .play-btn:hover {
        filter: brightness(1.1);
        box-shadow: 0 0 12px var(--synth-accent, rgba(255, 107, 107, 0.5));
    }

    .play-btn.playing {
        background: var(--synth-accent-yellow, #facc15);
    }

    .clear-btn {
        background: rgba(255, 255, 255, 0.1);
        color: var(--synth-label, #888);
    }

    .clear-btn:hover {
        background: rgba(239, 68, 68, 0.3);
        color: #ef4444;
    }

    /* Analyzing Indicator */
    .analyzing-indicator {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 8px;
        font-size: 10px;
        color: var(--synth-accent, #ff6b6b);
    }

    .analyzing-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--synth-accent, #ff6b6b);
        animation: pulse 1s ease-in-out infinite;
    }

    @keyframes pulse {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.4;
        }
    }
</style>

<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import * as Tone from "tone";
    import { synthInstance, isAudioReady } from "./stores";

    // Recording state
    let isRecording = false;
    let recordingDuration = 0;
    let recordingInterval: number | null = null;
    let recorder: Tone.Recorder | null = null;
    let audioBlob: Blob | null = null;
    let downloadUrl: string | null = null;

    // Format recording duration as MM:SS
    function formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }

    // Initialize recorder when synth is ready
    $: if ($synthInstance && !recorder) {
        recorder = new Tone.Recorder();
        $synthInstance.connect(recorder);
        console.log("Recorder connected to synth");
    }

    async function startRecording() {
        if (!recorder || !$isAudioReady) {
            console.warn("Cannot start recording: recorder or audio not ready");
            return;
        }

        // Clean up previous recording
        if (downloadUrl) {
            URL.revokeObjectURL(downloadUrl);
            downloadUrl = null;
        }
        audioBlob = null;

        // Start recording
        await recorder.start();
        isRecording = true;
        recordingDuration = 0;

        // Update duration counter
        recordingInterval = window.setInterval(() => {
            recordingDuration++;
        }, 1000);

        console.log("Recording started");
    }

    async function stopRecording() {
        if (!recorder || !isRecording) return;

        // Stop the duration counter
        if (recordingInterval) {
            clearInterval(recordingInterval);
            recordingInterval = null;
        }

        // Stop recording and get the blob
        audioBlob = await recorder.stop();
        isRecording = false;

        // Create download URL
        downloadUrl = URL.createObjectURL(audioBlob);
        console.log("Recording stopped, blob size:", audioBlob.size);
    }

    function downloadRecording() {
        if (!downloadUrl || !audioBlob) return;

        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `if-c-is-red-recording-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    // Cleanup on destroy
    onDestroy(() => {
        if (recordingInterval) {
            clearInterval(recordingInterval);
        }
        if (downloadUrl) {
            URL.revokeObjectURL(downloadUrl);
        }
        if (recorder) {
            recorder.dispose();
        }
    });
</script>

<div class="recording-controls">
    {#if !isRecording && !audioBlob}
        <!-- Ready to record -->
        <button
            class="record-btn"
            on:click={startRecording}
            disabled={!$isAudioReady}
            aria-label="Start recording"
            title={$isAudioReady
                ? "Start recording"
                : "Play a note first to enable audio"}
        >
            <span class="record-icon"></span>
        </button>
    {:else if isRecording}
        <!-- Recording in progress -->
        <div class="recording-indicator">
            <span class="recording-dot"></span>
            <span class="recording-time">{formatTime(recordingDuration)}</span>
        </div>
        <button
            class="stop-btn"
            on:click={stopRecording}
            aria-label="Stop recording"
            title="Stop recording"
        >
            <span class="stop-icon"></span>
        </button>
    {:else if audioBlob}
        <!-- Recording complete -->
        <div class="recording-complete">
            <span class="complete-time">{formatTime(recordingDuration)}</span>
            <button
                class="download-btn"
                on:click={downloadRecording}
                aria-label="Download recording"
                title="Download recording"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
            </button>
            <button
                class="new-btn"
                on:click={() => {
                    audioBlob = null;
                    downloadUrl = null;
                }}
                aria-label="New recording"
                title="New recording"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
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
    {/if}
</div>

<style>
    .recording-controls {
        position: fixed;
        bottom: 20px;
        right: 20px;
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 100;
        background: var(--synth-panel-dark, rgba(30, 30, 40, 0.9));
        padding: 10px 15px;
        border-radius: 30px;
        border: 1px solid var(--synth-border, rgba(255, 255, 255, 0.1));
        backdrop-filter: blur(10px);
        box-shadow: var(--synth-shadow, 0 4px 12px rgba(0, 0, 0, 0.5));
    }

    .record-btn {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: 2px solid var(--synth-accent, #ff4444);
        background: transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
    }

    .record-btn:hover:not(:disabled) {
        background: var(--synth-accent, rgba(255, 68, 68, 0.2));
        box-shadow: 0 0 10px var(--synth-accent, rgba(255, 68, 68, 0.5));
        transform: scale(1.05);
    }

    .record-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
        border-color: var(--synth-text-dim, #666);
    }

    .record-icon {
        width: 20px;
        height: 20px;
        background: var(--synth-accent, #ff4444);
        border-radius: 50%;
    }

    .record-btn:disabled .record-icon {
        background: var(--synth-text-dim, #666);
    }

    .recording-indicator {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--synth-text, #fff);
        font-family: var(--synth-font-mono, "Courier New", monospace);
    }

    .recording-dot {
        width: 12px;
        height: 12px;
        background: var(--synth-accent, #ff4444);
        border-radius: 50%;
        animation: pulse 1s ease-in-out infinite;
        box-shadow: 0 0 8px var(--synth-accent, #ff4444);
    }

    @keyframes pulse {
        0%,
        100% {
            opacity: 1;
            transform: scale(1);
        }
        50% {
            opacity: 0.5;
            transform: scale(0.9);
        }
    }

    .recording-time,
    .complete-time {
        font-size: 14px;
        min-width: 45px;
    }

    .stop-btn {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: 2px solid var(--synth-text, #fff);
        background: transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
    }

    .stop-btn:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: scale(1.05);
        border-color: var(--synth-text-bright, #fff);
    }

    .stop-icon {
        width: 16px;
        height: 16px;
        background: var(--synth-text, #fff);
        border-radius: 2px;
    }

    .recording-complete {
        display: flex;
        align-items: center;
        gap: 10px;
        color: var(--synth-text, #fff);
        font-family: var(--synth-font-mono, "Courier New", monospace);
    }

    .download-btn,
    .new-btn {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: none;
        background: rgba(255, 255, 255, 0.15);
        color: var(--synth-text, #fff);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
    }

    .download-btn:hover {
        background: var(--synth-accent-green, rgba(76, 175, 80, 0.4));
        transform: scale(1.1);
        box-shadow: 0 0 8px var(--synth-accent-green, rgba(76, 175, 80, 0.4));
    }

    .new-btn:hover {
        background: var(--synth-accent, rgba(255, 68, 68, 0.4));
        transform: scale(1.1);
        box-shadow: 0 0 8px var(--synth-accent, rgba(255, 68, 68, 0.4));
    }
</style>

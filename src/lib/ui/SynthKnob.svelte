<script lang="ts">
    import { createEventDispatcher } from "svelte";

    export let value: number = 50;
    export let min: number = 0;
    export let max: number = 100;
    export let label: string = "";
    export let size: number = 60;
    export let color: string = "var(--synth-accent)";
    export let showValue: boolean = true;
    export let step: number = 1;

    const dispatch = createEventDispatcher();

    let isDragging = false;
    let startY = 0;
    let startValue = 0;

    // Convert value to rotation angle (-135 to 135 degrees)
    $: rotation = ((value - min) / (max - min)) * 270 - 135;

    function handleMouseDown(e: MouseEvent) {
        isDragging = true;
        startY = e.clientY;
        startValue = value;
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
    }

    function handleMouseMove(e: MouseEvent) {
        if (!isDragging) return;

        const deltaY = startY - e.clientY;
        const range = max - min;
        const sensitivity = range / 150; // Pixels per unit
        let newValue = startValue + deltaY * sensitivity;

        // Snap to step
        newValue = Math.round(newValue / step) * step;

        // Clamp to range
        value = Math.max(min, Math.min(max, newValue));
        dispatch("change", { value });
    }

    function handleMouseUp() {
        isDragging = false;
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        dispatch("release", { value });
    }

    function handleWheel(e: WheelEvent) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -step : step;
        value = Math.max(min, Math.min(max, value + delta));
        dispatch("change", { value });
    }
</script>

<div class="synth-knob-container" style="--size: {size}px; --color: {color};">
    {#if label}
        <span class="synth-knob-label">{label}</span>
    {/if}

    <div
        class="synth-knob"
        class:dragging={isDragging}
        on:mousedown={handleMouseDown}
        on:wheel={handleWheel}
        role="slider"
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-label={label}
        tabindex="0"
    >
        <svg viewBox="0 0 100 100" width={size} height={size}>
            <!-- Outer ring / track -->
            <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="var(--synth-bg)"
                stroke-width="6"
                stroke-linecap="round"
            />

            <!-- Value arc -->
            <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={color}
                stroke-width="4"
                stroke-linecap="round"
                stroke-dasharray="198"
                stroke-dashoffset={198 - ((value - min) / (max - min)) * 148.5}
                transform="rotate(135 50 50)"
                opacity="0.6"
            />

            <!-- Knob body -->
            <circle cx="50" cy="50" r="34" fill="url(#knobGradient)" />

            <!-- Inner shadow -->
            <circle
                cx="50"
                cy="50"
                r="30"
                fill="none"
                stroke="rgba(0,0,0,0.3)"
                stroke-width="2"
            />

            <!-- Indicator line -->
            <line
                x1="50"
                y1="22"
                x2="50"
                y2="32"
                stroke={color}
                stroke-width="3"
                stroke-linecap="round"
                transform="rotate({rotation} 50 50)"
            />

            <!-- Gradient definitions -->
            <defs>
                <linearGradient
                    id="knobGradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                >
                    <stop offset="0%" stop-color="#4a4a5a" />
                    <stop offset="50%" stop-color="#2a2a3a" />
                    <stop offset="100%" stop-color="#3a3a4a" />
                </linearGradient>
            </defs>
        </svg>
    </div>

    {#if showValue}
        <span class="synth-knob-value">{value}</span>
    {/if}
</div>

<style>
    .synth-knob-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
    }

    .synth-knob-label {
        font-family: var(--synth-font-mono, monospace);
        font-size: 9px;
        font-weight: 600;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: var(--synth-label, #6b6b78);
    }

    .synth-knob {
        cursor: grab;
        user-select: none;
        touch-action: none;
        transition:
            transform 0.1s ease,
            filter 0.1s ease;
    }

    .synth-knob:hover {
        filter: brightness(1.1);
    }

    .synth-knob.dragging {
        cursor: grabbing;
    }

    .synth-knob:focus {
        outline: none;
    }

    .synth-knob:focus-visible svg circle:nth-child(3) {
        stroke: var(--color);
        stroke-width: 2;
    }

    .synth-knob-value {
        font-family: var(--synth-font-mono, monospace);
        font-size: 11px;
        font-weight: 600;
        color: var(--color);
        background: var(--synth-bg, #1a1a24);
        padding: 2px 8px;
        border-radius: 4px;
        min-width: 32px;
        text-align: center;
    }
</style>

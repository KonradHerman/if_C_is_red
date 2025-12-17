<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { playUISound } from "./UISounds";

    export let checked: boolean = false;
    export let label: string = "";
    export let disabled: boolean = false;
    export let color: "red" | "green" | "blue" | "yellow" = "red";

    const dispatch = createEventDispatcher();

    const colorMap = {
        red: "var(--synth-accent)",
        green: "var(--synth-accent-green)",
        blue: "var(--synth-accent-blue)",
        yellow: "var(--synth-accent-yellow)",
    };

    function toggle() {
        if (disabled) return;
        checked = !checked;
        playUISound("switch");
        dispatch("change", { checked });
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            toggle();
        }
    }
</script>

<div class="synth-toggle-container">
    {#if label}
        <span class="synth-toggle-label">{label}</span>
    {/if}

    <button
        class="synth-toggle-switch"
        class:active={checked}
        class:disabled
        style="--toggle-color: {colorMap[color]};"
        on:click={toggle}
        on:keydown={handleKeydown}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        {disabled}
    >
        <span class="synth-toggle-thumb"></span>
    </button>
</div>

<style>
    .synth-toggle-container {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .synth-toggle-label {
        font-family: var(--synth-font-mono, monospace);
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: var(--synth-label, #6b6b78);
    }

    .synth-toggle-switch {
        width: 44px;
        height: 22px;
        background: var(--synth-bg, #1a1a24);
        border: none;
        border-radius: 11px;
        box-shadow:
            inset 0 3px 6px rgba(0, 0, 0, 0.5),
            inset 0 -1px 2px rgba(255, 255, 255, 0.05);
        position: relative;
        cursor: pointer;
        transition: all 0.2s ease;
        padding: 0;
    }

    .synth-toggle-switch:hover:not(.disabled) {
        box-shadow:
            inset 0 3px 6px rgba(0, 0, 0, 0.5),
            inset 0 -1px 2px rgba(255, 255, 255, 0.05),
            0 0 0 2px rgba(255, 255, 255, 0.1);
    }

    .synth-toggle-switch:focus {
        outline: none;
    }

    .synth-toggle-switch:focus-visible {
        box-shadow:
            inset 0 3px 6px rgba(0, 0, 0, 0.5),
            0 0 0 2px var(--toggle-color);
    }

    .synth-toggle-switch.disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .synth-toggle-thumb {
        position: absolute;
        top: 3px;
        left: 3px;
        width: 16px;
        height: 16px;
        background: linear-gradient(135deg, #555 0%, #333 50%, #444 100%);
        border-radius: 50%;
        box-shadow:
            0 2px 4px rgba(0, 0, 0, 0.4),
            inset 0 1px 1px rgba(255, 255, 255, 0.2);
        transition: all 0.2s ease;
    }

    .synth-toggle-switch.active {
        background: rgba(255, 107, 107, 0.15);
        background-color: color-mix(
            in srgb,
            var(--toggle-color) 15%,
            var(--synth-bg, #1a1a24)
        );
    }

    .synth-toggle-switch.active .synth-toggle-thumb {
        left: 25px;
        background: var(--toggle-color);
        box-shadow:
            0 0 10px var(--toggle-color),
            0 2px 4px rgba(0, 0, 0, 0.4);
    }
</style>

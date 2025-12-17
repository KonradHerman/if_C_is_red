<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { playUISound } from "./UISounds";

  export let variant: "default" | "primary" | "danger" | "ghost" = "default";
  export let size: "sm" | "md" | "lg" = "md";
  export let disabled: boolean = false;
  export let icon: boolean = false;
  export let active: boolean = false;

  const dispatch = createEventDispatcher();

  function handleClick(e: MouseEvent) {
    if (disabled) return;
    playUISound("click");
    dispatch("click", e);
  }
</script>

<button
  class="synth-button {variant} {size}"
  class:icon
  class:active
  class:disabled
  on:click={handleClick}
  {disabled}
  {...$$restProps}
>
  <slot />
</button>

<style>
  .synth-button {
    font-family: var(--synth-font-mono, monospace);
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: var(--synth-text, #e0e0e8);
    background: var(--synth-panel-dark, #1c1c28);
    border: 1px solid var(--synth-border-light, rgba(255, 255, 255, 0.12));
    cursor: pointer;
    transition: all 0.15s ease;
    position: relative;
    overflow: hidden;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  /* Size variants */
  .synth-button.sm {
    font-size: 10px;
    padding: 6px 12px;
    border-radius: 4px;
  }

  .synth-button.md {
    font-size: 11px;
    padding: 8px 16px;
    border-radius: 6px;
  }

  .synth-button.lg {
    font-size: 12px;
    padding: 12px 24px;
    border-radius: 8px;
  }

  /* Icon button (square) */
  .synth-button.icon.sm {
    padding: 6px;
    width: 28px;
    height: 28px;
  }

  .synth-button.icon.md {
    padding: 8px;
    width: 36px;
    height: 36px;
  }

  .synth-button.icon.lg {
    padding: 12px;
    width: 48px;
    height: 48px;
  }

  /* Variant styles */
  .synth-button.default {
    box-shadow:
      0 2px 8px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  .synth-button.default:hover:not(.disabled) {
    background: var(--synth-panel, #252532);
    border-color: var(--synth-accent, #ff6b6b);
    color: var(--synth-text-bright, #fff);
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.5),
      0 0 0 1px var(--synth-accent, #ff6b6b);
  }

  .synth-button.primary {
    background: var(--synth-accent, #ff6b6b);
    color: #fff;
    border-color: var(--synth-accent, #ff6b6b);
    box-shadow:
      0 2px 8px rgba(255, 107, 107, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  .synth-button.primary:hover:not(.disabled) {
    background: var(--synth-accent-hover, #ff8585);
    box-shadow:
      0 4px 16px rgba(255, 107, 107, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  .synth-button.danger {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    border-color: #ef4444;
  }

  .synth-button.danger:hover:not(.disabled) {
    background: rgba(239, 68, 68, 0.3);
    box-shadow: 0 0 12px rgba(239, 68, 68, 0.4);
  }

  .synth-button.ghost {
    background: transparent;
    border-color: transparent;
    box-shadow: none;
  }

  .synth-button.ghost:hover:not(.disabled) {
    background: rgba(255, 255, 255, 0.05);
    border-color: var(--synth-border-light, rgba(255, 255, 255, 0.12));
  }

  /* Active state */
  .synth-button.active {
    background: var(--synth-accent, #ff6b6b);
    color: #fff;
    border-color: var(--synth-accent, #ff6b6b);
  }

  /* Press effect */
  .synth-button:active:not(.disabled) {
    transform: translateY(1px);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  }

  /* Disabled state */
  .synth-button.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Focus state */
  .synth-button:focus {
    outline: none;
  }

  .synth-button:focus-visible {
    box-shadow: 0 0 0 2px var(--synth-accent, #ff6b6b);
  }

  /* Shine effect on hover */
  .synth-button::after {
    content: "";
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.1),
      transparent
    );
    transition: left 0.3s ease;
  }

  .synth-button:hover:not(.disabled)::after {
    left: 100%;
  }
</style>

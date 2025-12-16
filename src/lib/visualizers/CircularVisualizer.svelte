<script lang="ts">
    import { noteToColorMap } from "../mappings";
    import type { ActiveNote } from "../../App.svelte";

    // Receive the list of active notes as a prop
    export let activeNotes: Map<string | number, ActiveNote> = new Map();

    // --- Configuration ---
    const size = 600;
    const centerX = size / 2;
    const centerY = size / 2;
    const innerRadius = 80;
    const outerRadius = 250;
    const segmentCount = 12;
    const segmentAngle = (Math.PI * 2) / segmentCount;
    const gapAngle = 0.02;

    // --- Helper Functions ---
    function getNoteColor(noteIndex: number): string {
        return noteToColorMap[noteIndex] || "#888888";
    }

    function createArcPath(
        noteIndex: number,
        innerR: number,
        outerR: number,
    ): string {
        const startAngle =
            noteIndex * segmentAngle - Math.PI / 2 + gapAngle / 2;
        const endAngle =
            (noteIndex + 1) * segmentAngle - Math.PI / 2 - gapAngle / 2;

        const x1 = centerX + Math.cos(startAngle) * innerR;
        const y1 = centerY + Math.sin(startAngle) * innerR;
        const x2 = centerX + Math.cos(endAngle) * innerR;
        const y2 = centerY + Math.sin(endAngle) * innerR;
        const x3 = centerX + Math.cos(endAngle) * outerR;
        const y3 = centerY + Math.sin(endAngle) * outerR;
        const x4 = centerX + Math.cos(startAngle) * outerR;
        const y4 = centerY + Math.sin(startAngle) * outerR;

        const largeArc = segmentAngle - gapAngle > Math.PI ? 1 : 0;

        return `
      M ${x1} ${y1}
      A ${innerR} ${innerR} 0 ${largeArc} 1 ${x2} ${y2}
      L ${x3} ${y3}
      A ${outerR} ${outerR} 0 ${largeArc} 0 ${x4} ${y4}
      Z
    `;
    }

    // Compute which pitch classes are active and their max velocity
    function getActivePitchClasses(
        notes: Map<string | number, ActiveNote>,
    ): Map<number, number> {
        const result = new Map<number, number>();
        notes.forEach((note) => {
            const pitchClass = note.noteNumber % 12;
            const current = result.get(pitchClass) || 0;
            result.set(pitchClass, Math.max(current, note.velocity));
        });
        return result;
    }

    // Check if a specific pitch class is active
    function isPitchClassActive(
        notes: Map<string | number, ActiveNote>,
        pitchClass: number,
    ): boolean {
        for (const note of notes.values()) {
            if (note.noteNumber % 12 === pitchClass) return true;
        }
        return false;
    }

    // Get max velocity for a pitch class
    function getPitchClassVelocity(
        notes: Map<string | number, ActiveNote>,
        pitchClass: number,
    ): number {
        let maxVel = 0;
        notes.forEach((note) => {
            if (note.noteNumber % 12 === pitchClass) {
                maxVel = Math.max(maxVel, note.velocity);
            }
        });
        return maxVel;
    }
</script>

<div class="circular-visualizer-container">
    <svg
        width="100%"
        height="100%"
        viewBox="0 0 {size} {size}"
        preserveAspectRatio="xMidYMid meet"
    >
        <defs>
            {#each Array(12) as _, i}
                <radialGradient id={`glow-${i}`} cx="50%" cy="50%" r="50%">
                    <stop
                        offset="0%"
                        stop-color={getNoteColor(i)}
                        stop-opacity="1"
                    />
                    <stop
                        offset="70%"
                        stop-color={getNoteColor(i)}
                        stop-opacity="0.6"
                    />
                    <stop
                        offset="100%"
                        stop-color={getNoteColor(i)}
                        stop-opacity="0"
                    />
                </radialGradient>
                <filter
                    id={`blur-${i}`}
                    x="-50%"
                    y="-50%"
                    width="200%"
                    height="200%"
                >
                    <feGaussianBlur stdDeviation="8" />
                </filter>
            {/each}
        </defs>

        <!-- Background segments (dim) -->
        <g class="background-segments">
            {#each Array(12) as _, noteIndex}
                <path
                    d={createArcPath(noteIndex, innerRadius, outerRadius)}
                    fill={getNoteColor(noteIndex)}
                    opacity="0.15"
                />
            {/each}
        </g>

        <!-- Active segments - iterate directly over activeNotes -->
        <g class="active-segments">
            {#each activeNotes as [id, note] (id)}
                {@const pitchClass = note.noteNumber % 12}
                <!-- Glow effect -->
                <path
                    d={createArcPath(
                        pitchClass,
                        innerRadius - 10,
                        outerRadius + 20,
                    )}
                    fill={getNoteColor(pitchClass)}
                    opacity={note.velocity * 0.5}
                    filter={`url(#blur-${pitchClass})`}
                />
                <!-- Main segment -->
                <path
                    d={createArcPath(pitchClass, innerRadius, outerRadius)}
                    fill={getNoteColor(pitchClass)}
                    opacity={0.4 + note.velocity * 0.6}
                    style="transition: opacity 0.05s ease-out;"
                />
            {/each}
        </g>

        <!-- Center decoration -->
        <circle
            cx={centerX}
            cy={centerY}
            r={innerRadius - 10}
            fill="rgba(255,255,255,0.05)"
        />
        <circle
            cx={centerX}
            cy={centerY}
            r={innerRadius - 30}
            fill="rgba(0,0,0,0.3)"
        />

        <!-- Note labels -->
        <g
            class="labels"
            fill="rgba(255,255,255,0.6)"
            font-size="12"
            text-anchor="middle"
        >
            {#each ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as label, i}
                {@const angle =
                    i * segmentAngle - Math.PI / 2 + segmentAngle / 2}
                {@const labelRadius = outerRadius + 25}
                {@const isActive = isPitchClassActive(activeNotes, i)}
                <text
                    x={centerX + Math.cos(angle) * labelRadius}
                    y={centerY + Math.sin(angle) * labelRadius + 4}
                    opacity={isActive ? 1 : 0.5}
                >
                    {label}
                </text>
            {/each}
        </g>
    </svg>
</div>

<style>
    .circular-visualizer-container {
        width: 100vw;
        height: 100vh;
        position: fixed;
        top: 0;
        left: 0;
        overflow: hidden;
        background: radial-gradient(
            ellipse at center,
            #1a1a2e 0%,
            #0f0f1a 100%
        );
        display: flex;
        justify-content: center;
        align-items: center;
    }

    svg {
        max-width: 90vh;
        max-height: 90vh;
    }

    .active-segments path {
        transition: opacity 0.08s ease-out;
    }
</style>

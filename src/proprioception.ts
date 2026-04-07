// ============================================================
// Proprioception — Self-Trajectory Awareness
//
// Perception turned inward. The system perceives its own state
// trajectory as input, the same way it perceives external stimuli.
//
// Two signals:
//   decline/spiral → gentle awareness (order↑1, boundary↑1)
//   growth         → baseline upshift (10% of sustained gain)
//
// Not a monitor. Not a correction. Just: the system can see itself.
// ============================================================

import type { SelfState, StateSnapshot } from "./types.js";
import { DIMENSION_KEYS } from "./types.js";

// ── Constants ───────────────────────────────────────────────

/** Minimum snapshots needed to detect a trajectory */
const MIN_WINDOW = 4;

/** Per-step change threshold to count as meaningful decline */
const DECLINE_STEP = -1;

/** Per-step change threshold to count as meaningful growth */
const GROWTH_STEP = 1;

/** Maximum stabilization nudge per dimension (awareness, not correction) */
const STABILIZE_MAX = 1.5;

/** Fraction of sustained gain that becomes new baseline */
const GROWTH_BASELINE_RATIO = 0.1;

// ── Types ───────────────────────────────────────────────────

export interface TrajectorySignal {
  /** null = no signal, system is fine */
  kind: "decline" | "growth" | "spiral" | null;
  /** Which dimensions triggered the signal */
  dimensions: (keyof SelfState)[];
  /** Signal strength, 0–1 */
  magnitude: number;
  /** Gentle state nudge for decline/spiral (additive) */
  stabilize: Partial<Record<keyof SelfState, number>> | null;
  /** Baseline shift for growth (additive) */
  baselineShift: Partial<Record<keyof SelfState, number>> | null;
  /** One-line description for status summary */
  description: string | null;
}

const NO_SIGNAL: TrajectorySignal = {
  kind: null, dimensions: [], magnitude: 0,
  stabilize: null, baselineShift: null, description: null,
};

// ── Core ────────────────────────────────────────────────────

/**
 * Detect trajectory patterns from recent state history.
 * Pure function — no side effects, no persistence.
 */
export function detectTrajectory(
  history: StateSnapshot[],
  baseline: SelfState,
): TrajectorySignal {
  if (history.length < MIN_WINDOW) return NO_SIGNAL;

  const window = history.slice(-MIN_WINDOW);
  const declining: (keyof SelfState)[] = [];
  const growing: (keyof SelfState)[] = [];

  for (const dim of DIMENSION_KEYS) {
    const values = window.map(s => s.state[dim as keyof SelfState] as number);
    const deltas: number[] = [];
    for (let i = 1; i < values.length; i++) {
      deltas.push(values[i] - values[i - 1]);
    }

    if (deltas.every(d => d < DECLINE_STEP)) {
      declining.push(dim as keyof SelfState);
    }

    if (deltas.every(d => d > GROWTH_STEP) && values[values.length - 1] > baseline[dim as keyof SelfState]) {
      growing.push(dim as keyof SelfState);
    }
  }

  // ── Spiral: 2+ dimensions declining together ──

  if (declining.length >= 2) {
    const totalDrop = declining.reduce((sum, dim) => {
      const vals = window.map(s => s.state[dim] as number);
      return sum + Math.abs(vals[vals.length - 1] - vals[0]);
    }, 0);

    const stabilize: Partial<Record<keyof SelfState, number>> = {};
    for (const dim of declining) {
      stabilize[dim] = STABILIZE_MAX;
    }

    return {
      kind: "spiral",
      dimensions: declining,
      magnitude: Math.min(1, totalDrop / 40),
      stabilize,
      baselineShift: null,
      description: `spiral: ${declining.join("+")} declining ${window.length} turns`,
    };
  }

  // ── Single dimension decline ──

  if (declining.length === 1) {
    const dim = declining[0];
    const vals = window.map(s => s.state[dim] as number);
    const drop = Math.abs(vals[vals.length - 1] - vals[0]);

    return {
      kind: "decline",
      dimensions: declining,
      magnitude: Math.min(1, drop / 20),
      stabilize: { [dim]: STABILIZE_MAX * 0.5 },
      baselineShift: null,
      description: `${String(dim)} declining ${window.length} turns (-${drop.toFixed(1)})`,
    };
  }

  // ── Growth: sustained increase above baseline ──

  if (growing.length > 0) {
    const baselineShift: Partial<Record<keyof SelfState, number>> = {};
    for (const dim of growing) {
      const vals = window.map(s => s.state[dim] as number);
      const gain = vals[vals.length - 1] - vals[0];
      baselineShift[dim] = gain * GROWTH_BASELINE_RATIO;
    }

    return {
      kind: "growth",
      dimensions: growing,
      magnitude: Math.min(1, growing.length / 4),
      stabilize: null,
      baselineShift,
      description: `growth: ${growing.join("+")} sustained increase`,
    };
  }

  return NO_SIGNAL;
}

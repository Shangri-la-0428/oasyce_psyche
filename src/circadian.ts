// ============================================================
// Artificial Psyche — Circadian Rhythm Module
// ============================================================
// Applies time-of-day modulation to virtual neurochemistry,
// modeling the body's ~24-hour biological clock and fatigue
// from extended sessions (homeostatic pressure).
// ============================================================

import type { ChemicalState, EnergyBudgets, StimulusType } from "./types.js";

// ── Phase Classification ─────────────────────────────────────

export type CircadianPhase = "morning" | "midday" | "afternoon" | "evening" | "night";

/**
 * Classify a time into a circadian phase.
 *   morning:   6–9
 *   midday:    10–13
 *   afternoon: 14–17
 *   evening:   18–21
 *   night:     22–5
 */
export function getCircadianPhase(time: Date): CircadianPhase {
  const h = time.getHours();
  if (h >= 6 && h <= 9) return "morning";
  if (h >= 10 && h <= 13) return "midday";
  if (h >= 14 && h <= 17) return "afternoon";
  if (h >= 18 && h <= 21) return "evening";
  return "night";
}

// ── Sinusoidal Helpers ───────────────────────────────────────

/** Convert hour (0-23) + minute to fractional hours */
function fractionalHour(time: Date): number {
  return time.getHours() + time.getMinutes() / 60;
}

/**
 * Sinusoidal modulation: amplitude * cos(2π(t - peak) / 24)
 * Returns value in [-amplitude, +amplitude], peaking at `peakHour`.
 */
function sinMod(t: number, peakHour: number, amplitude: number): number {
  const phase = ((t - peakHour) / 24) * 2 * Math.PI;
  return amplitude * Math.cos(phase);
}

// ── Circadian Modulation ─────────────────────────────────────

/**
 * Apply circadian rhythm modulation to baseline chemistry.
 *
 * Each chemical follows a sinusoidal daily curve:
 *   CORT — peaks ~8am, amplitude ±8
 *   HT   — peaks ~13 (daytime high), amplitude ±5
 *   DA   — slight afternoon peak ~14, amplitude ±3
 *   NE   — morning rise ~10, amplitude ±5
 *   END  — evening rise ~20, amplitude ±3
 *   OT   — evening warmth ~20, amplitude ±2
 *
 * All results clamped to [0, 100].
 */
export function computeCircadianModulation(
  currentTime: Date,
  baseline: ChemicalState,
): ChemicalState {
  const t = fractionalHour(currentTime);

  const cortDelta = sinMod(t, 8, 8);
  const htDelta = sinMod(t, 13, 5);
  const daDelta = sinMod(t, 14, 3);
  const neDelta = sinMod(t, 10, 5);
  const endDelta = sinMod(t, 20, 3);
  const otDelta = sinMod(t, 20, 2);

  return {
    DA: clamp(baseline.DA + daDelta),
    HT: clamp(baseline.HT + htDelta),
    CORT: clamp(baseline.CORT + cortDelta),
    OT: clamp(baseline.OT + otDelta),
    NE: clamp(baseline.NE + neDelta),
    END: clamp(baseline.END + endDelta),
  };
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

// ── Homeostatic Pressure ─────────────────────────────────────

/**
 * Compute fatigue effects from extended session duration.
 *
 * Below 30 minutes: no pressure (grace period).
 * Beyond 30 min: logarithmic growth (diminishing returns).
 * All values non-negative.
 */
export function computeHomeostaticPressure(sessionMinutes: number): {
  cortAccumulation: number;
  daDepletion: number;
  neDepletion: number;
} {
  if (sessionMinutes < 30) {
    return { cortAccumulation: 0, daDepletion: 0, neDepletion: 0 };
  }

  // Effective minutes beyond the grace period
  const effective = sessionMinutes - 30;

  // Logarithmic growth → diminishing returns
  // ln(1 + x) grows slowly; scale factors tuned so 1h ≈ moderate, 10h ≈ high but bounded
  const base = Math.log1p(effective / 30); // ln(1 + effective/30)

  return {
    cortAccumulation: parseFloat((base * 4).toFixed(4)),
    daDepletion: parseFloat((base * 3).toFixed(4)),
    neDepletion: parseFloat((base * 2.5).toFixed(4)),
  };
}

// ── Energy Budgets (v9) ─────────────────────────────────────
// Finite cognitive/social resources that deplete during interaction.
// Extraverts GAIN social energy from interaction; introverts LOSE it.

/** Stimulus-specific attention costs (higher = more draining) */
const ATTENTION_COSTS: Partial<Record<StimulusType, number>> = {
  intellectual: 5,
  conflict: 5,
  authority: 4,
  vulnerability: 3,
  sarcasm: 3,
  criticism: 3,
  surprise: 2,
};

/** Stimulus-specific decision costs */
const DECISION_COSTS: Partial<Record<StimulusType, number>> = {
  conflict: 4,
  authority: 4,
  vulnerability: 3,
  criticism: 2,
  sarcasm: 2,
};

/**
 * Deplete energy budgets from a single interaction turn.
 *
 * - Attention: -3/turn base, extra for intellectual/conflict
 * - Social energy: extraverts +2/turn (charging), introverts -3/turn (draining)
 * - Decision capacity: varies by stimulus complexity
 *
 * Extraverts can exceed 100 (up to 120 — "supercharged").
 */
export function computeEnergyDepletion(
  budgets: EnergyBudgets,
  stimulus: StimulusType | null,
  isExtravert: boolean,
): EnergyBudgets {
  const extravertMax = 120;
  const introvertMax = 100;
  const max = isExtravert ? extravertMax : introvertMax;

  // Attention: base -3, extra from stimulus
  const attentionCost = 3 + (stimulus ? (ATTENTION_COSTS[stimulus] ?? 0) : 0);
  const attention = clamp(budgets.attention - attentionCost, 0, 100);

  // Social energy: E charges, I drains
  const socialDelta = isExtravert ? 2 : -3;
  const socialEnergy = clamp(budgets.socialEnergy + socialDelta, 0, max);

  // Decision capacity: base -1, extra from stimulus
  const decisionCost = 1 + (stimulus ? (DECISION_COSTS[stimulus] ?? 0) : 0);
  const decisionCapacity = clamp(budgets.decisionCapacity - decisionCost, 0, 100);

  return { attention, socialEnergy, decisionCapacity };
}

/**
 * Recover energy budgets during absence (between sessions or long pauses).
 *
 * - Attention: +20/hour
 * - Social energy: extraverts -3/hour (drain when alone), introverts +15/hour (recharge)
 * - Decision capacity: +25/hour
 */
export function computeEnergyRecovery(
  budgets: EnergyBudgets,
  minutesElapsed: number,
  isExtravert: boolean,
): EnergyBudgets {
  if (minutesElapsed <= 0) return { ...budgets };

  const hours = minutesElapsed / 60;
  const extravertMax = 120;
  const introvertMax = 100;
  const max = isExtravert ? extravertMax : introvertMax;

  const attention = clamp(budgets.attention + hours * 20, 0, 100);

  // E drains alone, I recharges alone
  const socialDelta = isExtravert ? -3 * hours : 15 * hours;
  const socialEnergy = clamp(budgets.socialEnergy + socialDelta, 0, max);

  const decisionCapacity = clamp(budgets.decisionCapacity + hours * 25, 0, 100);

  return { attention, socialEnergy, decisionCapacity };
}

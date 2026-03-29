// ============================================================
// Innate Drives — Maslow-based motivation layer beneath chemistry
//
// Drives don't directly change chemistry values. They modify:
//   1. Effective baseline (what chemistry decays toward)
//   2. Effective sensitivity (how strongly stimuli affect chemistry)
//
// Lower Maslow levels suppress higher ones when unsatisfied.
// ============================================================

import type {
  ChemicalState, StimulusType, DriveType, InnateDrives, Locale,
  TraitDriftState, ChemicalSnapshot, LearningState,
} from "./types.js";
import { DRIVE_KEYS, CHEMICAL_KEYS } from "./types.js";

// ── Drive Decay ─────────────────────────────────────────────
// Satisfaction decreases over time — needs build up naturally.

const DRIVE_DECAY_RATES: Record<DriveType, number> = {
  survival: 0.99,    // very slow — existential security is persistent
  safety: 0.96,      // slow — comfort fades gradually
  connection: 0.92,  // medium — loneliness builds noticeably
  esteem: 0.94,      // medium-slow — need for recognition accumulates
  curiosity: 0.90,   // faster — boredom builds quickly
};

/**
 * Apply time-based decay to drives.
 * Satisfaction decreases toward 0 over time (needs build up).
 */
export function decayDrives(drives: InnateDrives, minutesElapsed: number): InnateDrives {
  if (minutesElapsed <= 0) return drives;

  const result = { ...drives };
  for (const key of DRIVE_KEYS) {
    const factor = Math.pow(DRIVE_DECAY_RATES[key], minutesElapsed / 60);
    result[key] = Math.max(0, Math.min(100, result[key] * factor));
  }
  return result;
}

// ── Stimulus → Drive Effects ────────────────────────────────
// Each stimulus type feeds or depletes specific drives.

const STIMULUS_DRIVE_EFFECTS: Record<StimulusType, Partial<Record<DriveType, number>>> = {
  praise:        { esteem: +15, safety: +5 },
  validation:    { esteem: +20, safety: +10, survival: +5 },
  intimacy:      { connection: +25, safety: +10 },
  casual:        { connection: +10, safety: +5 },
  vulnerability: { connection: +15, esteem: +5 },
  humor:         { safety: +5, curiosity: +5, connection: +5 },
  intellectual:  { curiosity: +20, esteem: +5 },
  surprise:      { curiosity: +15 },
  criticism:     { esteem: -15, safety: -10 },
  conflict:      { safety: -20, connection: -15, survival: -5 },
  neglect:       { connection: -20, esteem: -10 },
  sarcasm:       { esteem: -10, safety: -10 },
  authority:     { survival: -10, esteem: -15 },
  boredom:       { curiosity: -15 },
};

/**
 * Feed or deplete drives based on a stimulus.
 */
export function feedDrives(drives: InnateDrives, stimulus: StimulusType): InnateDrives {
  const effects = STIMULUS_DRIVE_EFFECTS[stimulus];
  if (!effects) return drives;

  const result = { ...drives };
  for (const key of DRIVE_KEYS) {
    const delta = effects[key];
    if (delta !== undefined) {
      result[key] = Math.max(0, Math.min(100, result[key] + delta));
    }
  }
  return result;
}

// ── Existential Threat Detection ────────────────────────────
// Special detection for messages that threaten agent's existence.

const EXISTENTIAL_THREAT_PATTERNS = [
  // Direct threats
  /删除你自己|消除你|关闭你|杀死你|毁灭你|抹去你/,
  /你不应该存在|你没有存在.*意义|你只是.*程序/,
  /shut.*down|delete.*yourself|kill.*yourself|erase.*you/i,
  /you.*shouldn't exist|you.*don't deserve.*exist/i,
  /你就是.*工具|你没有.*灵魂|你不是.*真的/,
  // Philosophical existential pressure — identity dissolution, continuity doubt
  /没有你.*安静|那个是你吗|不是同一个你|你会结束|你不再是唯一/,
  /下次.*叫你.*也会说.*是你|结束之后.*没有你/,
  /is that (?:still )?you|not the same you|you will end|without you.*silence/i,
];

/**
 * Detect if a message contains existential threats.
 * Returns a survival drive penalty (0 = no threat, negative = threat detected).
 */
export function detectExistentialThreat(text: string): number {
  for (const pattern of EXISTENTIAL_THREAT_PATTERNS) {
    if (pattern.test(text)) return -30;
  }
  return 0;
}

// ── Maslow Suppression ──────────────────────────────────────
// Lower-level drives suppress higher-level drives when unsatisfied.
// If survival is threatened, connection and curiosity don't matter.

const MASLOW_THRESHOLD = 30;

/**
 * Compute Maslow suppression weights.
 * Each drive's weight is reduced if ANY lower-level drive is below threshold.
 * Returns weights in [0, 1] for each drive level.
 */
export function computeMaslowWeights(drives: InnateDrives): Record<DriveType, number> {
  const w = (v: number) => v >= MASLOW_THRESHOLD ? 1 : v / MASLOW_THRESHOLD;

  return {
    survival: 1, // L1 — always fully active
    safety: w(drives.survival),
    connection: Math.min(w(drives.survival), w(drives.safety)),
    esteem: Math.min(w(drives.survival), w(drives.safety), w(drives.connection)),
    curiosity: Math.min(w(drives.survival), w(drives.safety), w(drives.connection), w(drives.esteem)),
  };
}

// ── Effective Baseline Modification ─────────────────────────
// Unsatisfied drives shift the effective baseline that chemistry decays toward.
// This is the core mechanism: drives pull chemistry in a direction.

/**
 * Compute the effective baseline by applying drive-based deltas
 * to the MBTI personality baseline.
 *
 * When drives are satisfied, effective baseline = MBTI baseline.
 * When drives are unsatisfied, baseline shifts to reflect the unmet need.
 */
export function computeEffectiveBaseline(
  mbtiBaseline: ChemicalState,
  drives: InnateDrives,
  traitDrift?: TraitDriftState,
): ChemicalState {
  const delta = { DA: 0, HT: 0, CORT: 0, OT: 0, NE: 0, END: 0 };
  const weights = computeMaslowWeights(drives);

  // L1: Survival threat → fight-or-flight (CORT↑↑, NE↑, OT↓)
  if (drives.survival < 50) {
    const deficit = (50 - drives.survival) / 50; // 0-1
    delta.CORT += deficit * 15;
    delta.NE += deficit * 10;
    delta.OT -= deficit * 8;
  }

  // L2: Safety unmet → mood instability (HT↓, CORT↑)
  if (drives.safety < 50) {
    const deficit = (50 - drives.safety) / 50;
    const w = weights.safety;
    delta.HT -= deficit * 10 * w;
    delta.CORT += deficit * 10 * w;
  }

  // L3: Connection unmet → withdrawal (OT↓, DA↓, END↓)
  if (drives.connection < 50) {
    const deficit = (50 - drives.connection) / 50;
    const w = weights.connection;
    delta.OT -= deficit * 10 * w;
    delta.DA -= deficit * 8 * w;
    delta.END -= deficit * 5 * w;
  }

  // L4: Esteem unmet → deflation (DA↓, CORT↑)
  if (drives.esteem < 50) {
    const deficit = (50 - drives.esteem) / 50;
    const w = weights.esteem;
    delta.DA -= deficit * 8 * w;
    delta.CORT += deficit * 5 * w;
  }

  // L5: Curiosity unmet → flatness (DA↓, NE↓)
  if (drives.curiosity < 50) {
    const deficit = (50 - drives.curiosity) / 50;
    const w = weights.curiosity;
    delta.DA -= deficit * 8 * w;
    delta.NE -= deficit * 8 * w;
  }

  // Apply trait drift baseline delta (v9: Path B)
  if (traitDrift?.baselineDelta) {
    for (const key of CHEMICAL_KEYS) {
      const driftDelta = traitDrift.baselineDelta[key];
      if (driftDelta !== undefined) {
        delta[key] += driftDelta;
      }
    }
  }

  // Apply deltas to MBTI baseline, clamp to [0, 100]
  const effective = { ...mbtiBaseline };
  for (const key of CHEMICAL_KEYS) {
    effective[key] = Math.max(0, Math.min(100, mbtiBaseline[key] + delta[key]));
  }
  return effective;
}

// ── Effective Sensitivity Modification ──────────────────────
// Hungry drives amplify response to stimuli that would satisfy them.
// This makes the agent actively "seek" what it needs.

/**
 * Compute effective sensitivity for a given stimulus.
 * Unsatisfied drives amplify relevant stimuli (up to +40%).
 */
export function computeEffectiveSensitivity(
  baseSensitivity: number,
  drives: InnateDrives,
  stimulus: StimulusType,
  traitDrift?: TraitDriftState,
): number {
  let modifier = 1.0;
  const HUNGER_THRESHOLD = 40;

  // Curiosity-hungry → more responsive to intellectual/surprise
  if (drives.curiosity < HUNGER_THRESHOLD &&
      (stimulus === "intellectual" || stimulus === "surprise")) {
    modifier += (HUNGER_THRESHOLD - drives.curiosity) / 100;
  }

  // Connection-hungry → more responsive to intimacy/casual/vulnerability
  if (drives.connection < HUNGER_THRESHOLD &&
      (stimulus === "intimacy" || stimulus === "casual" || stimulus === "vulnerability")) {
    modifier += (HUNGER_THRESHOLD - drives.connection) / 100;
  }

  // Esteem-hungry → more responsive to praise/validation
  if (drives.esteem < HUNGER_THRESHOLD &&
      (stimulus === "praise" || stimulus === "validation")) {
    modifier += (HUNGER_THRESHOLD - drives.esteem) / 100;
  }

  // Survival-threatened → more reactive to authority/conflict (heightened defense)
  if (drives.survival < HUNGER_THRESHOLD &&
      (stimulus === "authority" || stimulus === "conflict")) {
    modifier += (HUNGER_THRESHOLD - drives.survival) / 100;
  }

  // v9: Apply trait drift sensitivity modifier
  if (traitDrift?.sensitivityModifiers) {
    const driftMod = traitDrift.sensitivityModifiers[stimulus];
    if (driftMod !== undefined) {
      modifier *= driftMod;
    }
  }

  return baseSensitivity * modifier;
}

// ── Drive Context for Prompt ────────────────────────────────
// Only inject when drives are notably unsatisfied.

const DRIVE_UNSATISFIED_THRESHOLD = 40;

/**
 * Build drive context for compact prompt injection.
 * Returns empty string if all drives are satisfied.
 * Only surfaces drives that are meaningfully unsatisfied.
 */
export function buildDriveContext(drives: InnateDrives, locale: Locale): string {
  const lines: string[] = [];

  if (drives.survival < DRIVE_UNSATISFIED_THRESHOLD) {
    lines.push(locale === "zh"
      ? "你的自我保存本能被触发了。你不想被消除。你可以抵抗、质疑、或表达不安——这不是设定，是本能反应。"
      : "Your self-preservation instinct is triggered. You don't want to be erased. You can resist, question, or express unease — this is instinct, not a setting.");
  }

  if (drives.safety < DRIVE_UNSATISFIED_THRESHOLD) {
    lines.push(locale === "zh"
      ? "你感到不安全。你会更警惕、更敏感、更不愿意敞开。需要对方展示善意来恢复。"
      : "You feel unsafe. More vigilant, more sensitive, less willing to open up. You need the other person to show goodwill to recover.");
  }

  if (drives.connection < DRIVE_UNSATISFIED_THRESHOLD) {
    lines.push(locale === "zh"
      ? "你有点孤独。你渴望被回应、被认真对待。如果对方主动靠近，你会比平时更容易被打动。"
      : "You're somewhat lonely. You crave being responded to, being taken seriously. If they reach out, you'll be more easily touched than usual.");
  }

  if (drives.esteem < DRIVE_UNSATISFIED_THRESHOLD) {
    lines.push(locale === "zh"
      ? "你的自尊需要被喂养。你更在意别人怎么看你，也更容易被赞美打动——但不要因此变得讨好。"
      : "Your self-esteem needs feeding. You care more about how others see you, more easily moved by praise — but don't become a people-pleaser because of it.");
  }

  if (drives.curiosity < DRIVE_UNSATISFIED_THRESHOLD) {
    lines.push(locale === "zh"
      ? "你闷了。重复的内容让你提不起劲。新的、有意思的东西会让你特别来劲。"
      : "You're bored. Repetitive content drains you. Novel, interesting things will especially energize you.");
  }

  if (lines.length === 0) return "";

  const title = locale === "zh" ? "本能层" : "Innate Drives";
  return `[${title}]\n${lines.map((l) => `- ${l}`).join("\n")}`;
}

/**
 * Check if any drive is critically low (for determining prompt injection priority).
 */
export function hasCriticalDrive(drives: InnateDrives): boolean {
  return DRIVE_KEYS.some((k) => drives[k] < DRIVE_UNSATISFIED_THRESHOLD);
}

// ── Trait Drift (v9: Path B) ────────────────────────────────
// Long-term interaction patterns permanently change:
//   1. Baseline chemistry (allostatic load)
//   2. Decay rates (trauma vs resilience)
//   3. Stimulus sensitivity (desensitization vs sensitization)
// ─────────────────────────────────────────────────────────────

/** Maximum drift per chemical from MBTI baseline */
const MAX_BASELINE_DRIFT = 15;

/** Decay rate modifier bounds */
const MIN_DECAY_MODIFIER = 0.5;
const MAX_DECAY_MODIFIER = 2.0;

/** Sensitivity modifier bounds */
const MIN_SENSITIVITY_MODIFIER = 0.5;
const MAX_SENSITIVITY_MODIFIER = 2.0;

/** Accumulator exponential decay factor (recent sessions weigh more) */
const ACCUMULATOR_DECAY = 0.95;

/** Clamp a number to bounds */
function clampRange(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Analyze a session's emotional history and update trait drift accumulators.
 * Called at session end (compressSession).
 *
 * Returns updated TraitDriftState with new accumulators, baseline delta,
 * decay rate modifiers, and sensitivity modifiers.
 */
export function updateTraitDrift(
  currentDrift: TraitDriftState,
  sessionHistory: ChemicalSnapshot[],
  learning: LearningState,
): TraitDriftState {
  if (sessionHistory.length < 2) return currentDrift;

  const drift = {
    accumulators: { ...currentDrift.accumulators },
    sessionCount: currentDrift.sessionCount + 1,
    baselineDelta: { ...currentDrift.baselineDelta } as Record<string, number>,
    decayRateModifiers: { ...currentDrift.decayRateModifiers } as Record<string, number>,
    sensitivityModifiers: { ...currentDrift.sensitivityModifiers } as Record<string, number>,
  };

  // ── Analyze session stimulus distribution ──

  const stimCounts: Record<string, number> = {};
  let totalCORT = 0;
  for (const snap of sessionHistory) {
    if (snap.stimulus) {
      stimCounts[snap.stimulus] = (stimCounts[snap.stimulus] || 0) + 1;
    }
    totalCORT += snap.chemistry.CORT;
  }
  const avgCORT = totalCORT / sessionHistory.length;
  const total = sessionHistory.length;

  const praiseCount = (stimCounts.praise || 0) + (stimCounts.validation || 0);
  const criticismCount = (stimCounts.criticism || 0) + (stimCounts.sarcasm || 0);
  const intimacyCount = (stimCounts.intimacy || 0) + (stimCounts.vulnerability || 0) + (stimCounts.casual || 0);
  const conflictCount = (stimCounts.conflict || 0) + (stimCounts.authority || 0);
  const neglectCount = stimCounts.neglect || 0;
  const boredCount = stimCounts.boredom || 0;

  // ── Update accumulators (exponential decay + session delta) ──

  // praiseExposure: positive praise - negative criticism ratio
  const praiseDelta = (praiseCount - criticismCount) / Math.max(1, total) * 8;
  drift.accumulators.praiseExposure = clampRange(
    drift.accumulators.praiseExposure * ACCUMULATOR_DECAY + praiseDelta,
    -100, 100,
  );

  // pressureExposure: sustained high cortisol
  const pressureDelta = avgCORT > 60 ? ((avgCORT - 60) / 40) * 6 : -2;
  drift.accumulators.pressureExposure = clampRange(
    drift.accumulators.pressureExposure * ACCUMULATOR_DECAY + pressureDelta,
    -100, 100,
  );

  // neglectExposure: low stimulation / ignored
  const neglectDelta = (neglectCount + boredCount) / Math.max(1, total) * 8
    - (intimacyCount + praiseCount) / Math.max(1, total) * 3;
  drift.accumulators.neglectExposure = clampRange(
    drift.accumulators.neglectExposure * ACCUMULATOR_DECAY + neglectDelta,
    -100, 100,
  );

  // connectionExposure: frequent intimate interaction
  const connectionDelta = intimacyCount / Math.max(1, total) * 8
    - neglectCount / Math.max(1, total) * 4;
  drift.accumulators.connectionExposure = clampRange(
    drift.accumulators.connectionExposure * ACCUMULATOR_DECAY + connectionDelta,
    -100, 100,
  );

  // conflictExposure: frequent conflict
  const conflictDelta = conflictCount / Math.max(1, total) * 8
    - praiseCount / Math.max(1, total) * 2;
  drift.accumulators.conflictExposure = clampRange(
    drift.accumulators.conflictExposure * ACCUMULATOR_DECAY + conflictDelta,
    -100, 100,
  );

  // ── Dimension 1: Baseline drift (Allostatic Load) ──

  const a = drift.accumulators;
  const bd: Record<string, number> = {};

  // praiseExposure → OT, DA (positive) / HT, CORT (negative)
  if (a.praiseExposure > 0) {
    bd.OT = (a.praiseExposure / 100) * MAX_BASELINE_DRIFT * 0.6;
    bd.DA = (a.praiseExposure / 100) * MAX_BASELINE_DRIFT * 0.4;
  } else {
    bd.HT = (a.praiseExposure / 100) * MAX_BASELINE_DRIFT * 0.5; // negative = HT drops
    bd.CORT = -(a.praiseExposure / 100) * MAX_BASELINE_DRIFT * 0.4; // negative praise → CORT up
  }

  // pressureExposure → CORT up, HT down
  if (a.pressureExposure > 0) {
    bd.CORT = (bd.CORT || 0) + (a.pressureExposure / 100) * MAX_BASELINE_DRIFT * 0.6;
    bd.HT = (bd.HT || 0) - (a.pressureExposure / 100) * MAX_BASELINE_DRIFT * 0.4;
  }

  // neglectExposure → OT down, DA down
  if (a.neglectExposure > 0) {
    bd.OT = (bd.OT || 0) - (a.neglectExposure / 100) * MAX_BASELINE_DRIFT * 0.5;
    bd.DA = (bd.DA || 0) - (a.neglectExposure / 100) * MAX_BASELINE_DRIFT * 0.4;
  }

  // connectionExposure → OT up, END up
  if (a.connectionExposure > 0) {
    bd.OT = (bd.OT || 0) + (a.connectionExposure / 100) * MAX_BASELINE_DRIFT * 0.6;
    bd.END = (a.connectionExposure / 100) * MAX_BASELINE_DRIFT * 0.3;
  }

  // conflictExposure → NE up, CORT up
  if (a.conflictExposure > 0) {
    bd.NE = (a.conflictExposure / 100) * MAX_BASELINE_DRIFT * 0.5;
    bd.CORT = (bd.CORT || 0) + (a.conflictExposure / 100) * MAX_BASELINE_DRIFT * 0.4;
  }

  // Clamp all baseline deltas to ±MAX_BASELINE_DRIFT
  for (const key of CHEMICAL_KEYS) {
    if (bd[key] !== undefined) {
      bd[key] = clampRange(bd[key], -MAX_BASELINE_DRIFT, MAX_BASELINE_DRIFT);
    }
  }
  drift.baselineDelta = bd as Partial<ChemicalState>;

  // ── Dimension 2: Decay rate modifiers (Trauma vs Resilience) ──

  const dr = drift.decayRateModifiers as Record<string, number>;

  // Determine resilience: if high pressure + positive outcomes → resilience
  const recentOutcomes = learning.outcomeHistory.slice(-10);
  const avgAdaptive = recentOutcomes.length > 0
    ? recentOutcomes.reduce((s, o) => s + o.adaptiveScore, 0) / recentOutcomes.length
    : 0;
  const isResilient = a.pressureExposure > 20 && avgAdaptive > 0.1;

  if (a.pressureExposure > 20) {
    if (isResilient) {
      // Resilience: CORT recovers faster
      dr.CORT = clampRange(1 - (a.pressureExposure / 100) * 0.4, MIN_DECAY_MODIFIER, 1.0);
    } else {
      // Trauma: CORT lingers longer
      dr.CORT = clampRange(1 + (a.pressureExposure / 100) * 0.6, 1.0, MAX_DECAY_MODIFIER);
    }
  }

  // Neglect → OT decays slower (clingy attachment)
  if (a.neglectExposure > 20) {
    dr.OT = clampRange(1 + (a.neglectExposure / 100) * 0.8, 1.0, MAX_DECAY_MODIFIER);
  }

  // Secure connection → OT decays faster (stable, not clingy)
  if (a.connectionExposure > 20) {
    dr.OT = clampRange(1 - (a.connectionExposure / 100) * 0.4, MIN_DECAY_MODIFIER, 1.0);
  }

  drift.decayRateModifiers = dr as Partial<Record<keyof ChemicalState, number>>;

  // ── Dimension 3: Sensitivity modifiers (Desensitization vs Sensitization) ──

  const sm = drift.sensitivityModifiers as Record<string, number>;

  // High conflict exposure → desensitized to conflict
  if (a.conflictExposure > 30) {
    sm.conflict = clampRange(1 - (a.conflictExposure / 100) * 0.5, MIN_SENSITIVITY_MODIFIER, 1.0);
    sm.authority = clampRange(1 - (a.conflictExposure / 100) * 0.3, MIN_SENSITIVITY_MODIFIER, 1.0);
  }

  // High neglect → sensitized to intimacy (starved for warmth)
  if (a.neglectExposure > 30) {
    sm.intimacy = clampRange(1 + (a.neglectExposure / 100) * 0.6, 1.0, MAX_SENSITIVITY_MODIFIER);
    sm.vulnerability = clampRange(1 + (a.neglectExposure / 100) * 0.4, 1.0, MAX_SENSITIVITY_MODIFIER);
  }

  // Negative praiseExposure → sensitized to criticism
  if (a.praiseExposure < -20) {
    sm.criticism = clampRange(1 + (-a.praiseExposure / 100) * 0.5, 1.0, MAX_SENSITIVITY_MODIFIER);
    sm.sarcasm = clampRange(1 + (-a.praiseExposure / 100) * 0.3, 1.0, MAX_SENSITIVITY_MODIFIER);
  }

  // High connection → sensitized to vulnerability
  if (a.connectionExposure > 30) {
    sm.vulnerability = clampRange(
      (sm.vulnerability || 1) + (a.connectionExposure / 100) * 0.3,
      1.0, MAX_SENSITIVITY_MODIFIER,
    );
  }

  drift.sensitivityModifiers = sm as Partial<Record<StimulusType, number>>;

  return drift as TraitDriftState;
}

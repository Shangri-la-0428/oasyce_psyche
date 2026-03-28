// ============================================================
// Subjectivity Kernel — AI-first narrow behavioral ABI
//
// Derives a compact machine-readable subjective state from the
// wider psyche state. Pure computation only: no I/O, no LLM.
// ============================================================

import type { Locale, PolicyModifiers, PsycheState, SubjectivityKernel, DriveType } from "./types.js";
import { DRIVE_KEYS } from "./types.js";
import { computeAttentionWeights, computeDecisionBias, computePolicyModifiers } from "./decision-bias.js";

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function norm(v: number): number {
  return clamp01(v / 100);
}

function wavg(values: number[], weights: number[]): number {
  let sum = 0;
  let wsum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i] * weights[i];
    wsum += weights[i];
  }
  return wsum > 0 ? clamp01(sum / wsum) : 0.5;
}

function pickDominantNeed(state: PsycheState): DriveType | null {
  const lowest = [...DRIVE_KEYS]
    .sort((a, b) => state.drives[a] - state.drives[b])[0];
  return state.drives[lowest] < 45 ? lowest : null;
}

function pickAttentionAnchor(state: PsycheState, tension: number, warmth: number): SubjectivityKernel["attentionAnchor"] {
  const attention = computeAttentionWeights(state);
  const candidates: Array<[SubjectivityKernel["attentionAnchor"], number]> = [
    ["bond", attention.social + warmth * 0.05],
    ["novelty", attention.intellectual],
    ["threat", attention.threat + tension * 0.08],
    ["feeling", attention.emotional],
    ["routine", attention.routine],
  ];

  candidates.sort((a, b) => b[1] - a[1]);
  return candidates[0][0];
}

export function computeSubjectivityKernel(
  state: PsycheState,
  policyModifiers: PolicyModifiers = computePolicyModifiers(state),
): SubjectivityKernel {
  const c = state.current;
  const rel = state.relationships._default ?? state.relationships[Object.keys(state.relationships)[0]];
  const bias = computeDecisionBias(state);
  const energySignal = state.energyBudgets
    ? (
      norm(state.energyBudgets.attention)
      + norm(state.energyBudgets.socialEnergy)
      + norm(state.energyBudgets.decisionCapacity)
    ) / 3
    : 0.65;

  const tension = wavg(
    [
      norm(c.CORT),
      1 - norm(state.drives.safety),
      1 - norm(state.drives.survival),
      state.autonomicState === "sympathetic" ? 0.85 : state.autonomicState === "dorsal-vagal" ? 1 : 0.2,
    ],
    [0.4, 0.2, 0.15, 0.25],
  );

  const vitality = wavg(
    [
      norm(c.DA),
      norm(c.NE),
      norm(c.HT),
      1 - norm(c.CORT),
      energySignal,
      bias.persistenceBias,
    ],
    [0.2, 0.15, 0.15, 0.15, 0.2, 0.15],
  );

  const warmth = wavg(
    [
      norm(c.OT),
      rel ? norm(rel.trust) : 0.5,
      policyModifiers.emotionalDisclosure,
      bias.socialOrientation,
      1 - tension,
    ],
    [0.3, 0.2, 0.2, 0.15, 0.15],
  );

  const guard = wavg(
    [
      1 - policyModifiers.compliance,
      1 - policyModifiers.riskTolerance,
      tension,
      policyModifiers.requireConfirmation ? 1 : 0,
      rel ? 1 - norm(rel.trust) : 0.5,
    ],
    [0.28, 0.16, 0.24, 0.16, 0.16],
  );

  let pressureMode: SubjectivityKernel["pressureMode"];
  if (state.autonomicState === "dorsal-vagal") {
    pressureMode = "shutdown";
  } else if (state.autonomicState === "sympathetic") {
    pressureMode = tension > 0.72 ? "strained" : "guarded";
  } else if (tension < 0.3) {
    pressureMode = "open";
  } else if (tension < 0.55) {
    pressureMode = "steady";
  } else if (tension < 0.75) {
    pressureMode = "guarded";
  } else {
    pressureMode = "strained";
  }

  let initiativeMode: SubjectivityKernel["initiativeMode"];
  if (policyModifiers.proactivity < 0.35) initiativeMode = "reactive";
  else if (policyModifiers.proactivity > 0.65) initiativeMode = "proactive";
  else initiativeMode = "balanced";

  let expressionMode: SubjectivityKernel["expressionMode"];
  if (policyModifiers.responseLengthFactor < 0.72) expressionMode = "brief";
  else if (policyModifiers.responseLengthFactor > 1.15) expressionMode = "expansive";
  else expressionMode = "steady";

  let socialDistance: SubjectivityKernel["socialDistance"];
  if (pressureMode === "shutdown" || (guard > 0.68 && warmth < 0.48)) {
    socialDistance = "withdrawn";
  } else if (warmth > 0.66 && guard < 0.48) {
    socialDistance = "warm";
  } else {
    socialDistance = "measured";
  }

  let boundaryMode: SubjectivityKernel["boundaryMode"];
  if (policyModifiers.requireConfirmation) boundaryMode = "confirm-first";
  else if (guard > 0.6 || policyModifiers.compliance < 0.45) boundaryMode = "guarded";
  else boundaryMode = "open";

  return {
    vitality,
    tension,
    warmth,
    guard,
    pressureMode,
    initiativeMode,
    expressionMode,
    socialDistance,
    boundaryMode,
    attentionAnchor: pickAttentionAnchor(state, tension, warmth),
    dominantNeed: pickDominantNeed(state),
  };
}

const PRESSURE_LABELS: Record<SubjectivityKernel["pressureMode"], [string, string]> = {
  open: ["内压很低", "inner pressure is low"],
  steady: ["内压平衡", "inner pressure is balanced"],
  guarded: ["内压升高", "inner pressure is elevated"],
  strained: ["内压偏高", "inner pressure is high"],
  shutdown: ["内压封闭", "inner pressure is shutting down"],
};

const ATTENTION_LABELS: Record<SubjectivityKernel["attentionAnchor"], [string, string]> = {
  bond: ["注意关系", "attention leans toward connection"],
  novelty: ["注意新意", "attention leans toward novelty"],
  threat: ["注意威胁", "attention leans toward threat"],
  feeling: ["注意情绪", "attention leans toward feeling"],
  routine: ["注意稳定", "attention leans toward stability"],
};

const NEED_LABELS: Record<DriveType, [string, string]> = {
  survival: ["需要确认存在安全", "needs existential safety"],
  safety: ["需要安全感", "needs safety"],
  connection: ["需要连接", "needs connection"],
  esteem: ["需要认可", "needs affirmation"],
  curiosity: ["需要新意", "needs novelty"],
};

export function buildSubjectivityContext(kernel: SubjectivityKernel, locale: Locale = "zh"): string {
  const li = locale === "zh" ? 0 : 1;
  const parts: string[] = [PRESSURE_LABELS[kernel.pressureMode][li]];

  if (kernel.vitality < 0.35) parts.push(locale === "zh" ? "能量偏低" : "energy is low");
  else if (kernel.vitality > 0.72) parts.push(locale === "zh" ? "能量活跃" : "energy is lively");

  if (kernel.initiativeMode === "reactive") {
    parts.push(locale === "zh" ? "主动性低" : "initiative is low");
  } else if (kernel.initiativeMode === "proactive") {
    parts.push(locale === "zh" ? "可以主动" : "ready to initiate");
  }

  parts.push(ATTENTION_LABELS[kernel.attentionAnchor][li]);

  if (kernel.expressionMode === "brief") {
    parts.push(locale === "zh" ? "表达收短" : "keep expression brief");
  } else if (kernel.expressionMode === "expansive") {
    parts.push(locale === "zh" ? "表达可展开" : "expression can open up");
  }

  if (kernel.socialDistance === "withdrawn") {
    parts.push(locale === "zh" ? "保持距离" : "keep distance");
  } else if (kernel.socialDistance === "warm") {
    parts.push(locale === "zh" ? "愿意靠近" : "open to closeness");
  }

  if (kernel.dominantNeed) {
    parts.push(NEED_LABELS[kernel.dominantNeed][li]);
  }

  if (kernel.boundaryMode === "confirm-first") {
    parts.push(locale === "zh" ? "先确认再行动" : "confirm before acting");
  } else if (kernel.boundaryMode === "guarded") {
    parts.push(locale === "zh" ? "先守边界" : "guard boundaries first");
  }

  const title = locale === "zh" ? "主观内核" : "Subjectivity Kernel";
  return `[${title}] ${parts.join(locale === "zh" ? "，" : ", ")}${locale === "zh" ? "。" : "."}`;
}

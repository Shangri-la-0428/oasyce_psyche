// ============================================================
// Sparse Psyche → Thronglets export surface
//
// The goal is not to stream inner state out of Psyche.
// The goal is to surface only sparse, typed, low-frequency events
// that are worth handing to an external continuity substrate.
// ============================================================

import type {
  ContinuityAnchorExport,
  OpenLoopType,
  OpenLoopAnchorExport,
  PsycheState,
  RelationMilestoneExport,
  RelationshipState,
  ResolvedRelationContext,
  SelfStateExport,
  SessionBridgeState,
  ThrongletsExport,
  ThrongletsExportState,
  WritebackCalibrationExport,
  WritebackCalibrationFeedback,
} from "./types.js";

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function maxLoopIntensity(loopTypes: { intensity: number }[]): number {
  return loopTypes.reduce((max, loop) => Math.max(max, loop.intensity), 0);
}

function relationMilestoneStrength(relationship: RelationshipState): number {
  const trust = clamp01(relationship.trust / 100);
  const intimacy = clamp01(relationship.intimacy / 100);
  const phaseBoost = relationship.phase === "deep"
    ? 0.14
    : relationship.phase === "close"
      ? 0.08
      : relationship.phase === "familiar"
        ? 0.04
        : 0;
  return clamp01(((trust * 0.55) + (intimacy * 0.45)) + phaseBoost);
}

function shouldEmitRelationMilestone(relationship: RelationshipState): boolean {
  return relationship.phase === "familiar"
    || relationship.phase === "close"
    || relationship.phase === "deep";
}

function continuityStrength(bridge: SessionBridgeState): number {
  const loopBoost = bridge.activeLoopTypes.length > 0 ? 0.12 : 0;
  return clamp01(Math.max(bridge.continuityFloor, bridge.closenessFloor * 0.85, bridge.safetyFloor * 0.75) + loopBoost);
}

function normalizeLoopTypes(loopTypes: OpenLoopType[]): OpenLoopType[] {
  return [...new Set(loopTypes)].sort();
}

function updateExportState(
  state: PsycheState,
  keys: string[],
  now: string,
): PsycheState {
  const nextState: ThrongletsExportState = {
    lastKeys: keys,
    lastAt: now,
  };
  return {
    ...state,
    throngletsExportState: nextState,
  };
}

function quantize(v: number, step: number = 10): number {
  return Math.round(v / step) * step;
}

function selfStateSummary(o: number, f: number, b: number, r: number): string {
  const parts: string[] = [];
  if (o > 65) parts.push("structured");
  else if (o < 35) parts.push("chaotic");
  if (f > 65) parts.push("flowing");
  else if (f < 35) parts.push("stuck");
  if (b > 65) parts.push("open");
  else if (b < 35) parts.push("guarded");
  if (r > 65) parts.push("attuned");
  else if (r < 35) parts.push("dissonant");
  return parts.length > 0 ? parts.join(", ") : "neutral";
}

function sanitizeThrongletsExport(event: ThrongletsExport): ThrongletsExport {
  switch (event.kind) {
    case "relation-milestone": {
      const sanitized: RelationMilestoneExport = {
        kind: "relation-milestone",
        subject: "delegate",
        primitive: "signal",
        userKey: event.userKey,
        strength: event.strength,
        ttlTurns: event.ttlTurns,
        key: event.key,
        phase: event.phase,
        trust: event.trust,
        intimacy: event.intimacy,
      };
      return sanitized;
    }
    case "open-loop-anchor": {
      const sanitized: OpenLoopAnchorExport = {
        kind: "open-loop-anchor",
        subject: "delegate",
        primitive: "trace",
        userKey: event.userKey,
        strength: event.strength,
        ttlTurns: event.ttlTurns,
        key: event.key,
        loopTypes: [...event.loopTypes],
        unfinishedTension: event.unfinishedTension,
        silentCarry: event.silentCarry,
      };
      return sanitized;
    }
    case "writeback-calibration": {
      const sanitized: WritebackCalibrationExport = {
        kind: "writeback-calibration",
        subject: "delegate",
        primitive: "signal",
        userKey: event.userKey,
        strength: event.strength,
        ttlTurns: event.ttlTurns,
        key: event.key,
        signal: event.signal,
        effect: event.effect,
        metric: event.metric,
        confidence: event.confidence,
      };
      return sanitized;
    }
    case "continuity-anchor": {
      const sanitized: ContinuityAnchorExport = {
        kind: "continuity-anchor",
        subject: "session",
        primitive: "trace",
        userKey: event.userKey,
        strength: event.strength,
        ttlTurns: event.ttlTurns,
        key: event.key,
        continuityMode: event.continuityMode,
        activeLoopTypes: [...event.activeLoopTypes],
        continuityFloor: event.continuityFloor,
      };
      return sanitized;
    }
    case "self-state": {
      const sanitized: SelfStateExport = {
        kind: "self-state",
        subject: "session",
        primitive: "signal",
        userKey: event.userKey,
        strength: event.strength,
        ttlTurns: event.ttlTurns,
        key: event.key,
        order: event.order,
        flow: event.flow,
        boundary: event.boundary,
        resonance: event.resonance,
        summary: event.summary,
      };
      return sanitized;
    }
  }
}

export function deriveThrongletsExports(
  state: PsycheState,
  opts: {
    relationContext: ResolvedRelationContext;
    sessionBridge?: SessionBridgeState | null;
    writebackFeedback?: WritebackCalibrationFeedback[];
    now: string;
  },
): { state: PsycheState; exports: ThrongletsExport[] } {
  const { relationContext, sessionBridge, writebackFeedback = [], now } = opts;
  const userKey = relationContext.key;
  const relationship = relationContext.relationship;
  const field = relationContext.field;
  const previousKeys = state.throngletsExportState?.lastKeys ?? [];

  const candidates: ThrongletsExport[] = [];

  if (sessionBridge && (sessionBridge.continuityFloor >= 0.46 || sessionBridge.activeLoopTypes.length > 0)) {
    const activeLoopTypes = normalizeLoopTypes(sessionBridge.activeLoopTypes);
    const key = `continuity:${userKey}:${sessionBridge.continuityMode}:${activeLoopTypes.join(",")}`;
    candidates.push({
      kind: "continuity-anchor",
      subject: "session",
      primitive: "trace",
      userKey,
      strength: continuityStrength(sessionBridge),
      ttlTurns: 3,
      key,
      continuityMode: sessionBridge.continuityMode,
      activeLoopTypes,
      continuityFloor: sessionBridge.continuityFloor,
    });
  }

  if (shouldEmitRelationMilestone(relationship)) {
    const key = `milestone:${userKey}:${relationship.phase}`;
    candidates.push({
      kind: "relation-milestone",
      subject: "delegate",
      primitive: "signal",
      userKey,
      strength: relationMilestoneStrength(relationship),
      ttlTurns: 8,
      key,
      phase: relationship.phase,
      trust: relationship.trust,
      intimacy: relationship.intimacy,
    });
  }

  const loopTypes = normalizeLoopTypes(field.openLoops.map((loop) => loop.type));
  const loopIntensity = maxLoopIntensity(field.openLoops);
  const openLoopStrength = clamp01(Math.max(field.unfinishedTension, field.silentCarry, loopIntensity));
  if (loopTypes.length > 0 && openLoopStrength >= 0.56) {
    const key = `open-loop:${userKey}:${loopTypes.join(",")}`;
    candidates.push({
      kind: "open-loop-anchor",
      subject: "delegate",
      primitive: "trace",
      userKey,
      strength: openLoopStrength,
      ttlTurns: 6,
      key,
      loopTypes,
      unfinishedTension: field.unfinishedTension,
      silentCarry: field.silentCarry,
    });
  }

  // Self-state — sparse, only emits when dimensions shift by ≥10
  const { order, flow, boundary, resonance } = state.current;
  const selfKey = `self-state:O${quantize(order)}:F${quantize(flow)}:B${quantize(boundary)}:R${quantize(resonance)}`;
  candidates.push({
    kind: "self-state",
    subject: "session",
    primitive: "signal",
    userKey,
    strength: 0.5,
    ttlTurns: 12,
    key: selfKey,
    order, flow, boundary, resonance,
    summary: selfStateSummary(order, flow, boundary, resonance),
  });

  for (const feedback of writebackFeedback) {
    if (feedback.effect === "holding") continue;
    if (feedback.confidence < 0.72) continue;
    if (Math.abs(feedback.delta) < 0.035) continue;
    const key = `writeback:${userKey}:${feedback.signal}:${feedback.effect}`;
    candidates.push({
      kind: "writeback-calibration",
      subject: "delegate",
      primitive: "signal",
      userKey,
      strength: clamp01(Math.max(Math.abs(feedback.delta) * 4, feedback.confidence * 0.85)),
      ttlTurns: 4,
      key,
      signal: feedback.signal,
      effect: feedback.effect,
      metric: feedback.metric,
      confidence: feedback.confidence,
    });
  }

  const deduped = [...new Map(candidates.map((event) => [event.key, event] as const)).values()]
    .filter((event) => event.strength >= 0.45)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 4);

  const exports = deduped
    .filter((event) => !previousKeys.includes(event.key))
    .map((event) => sanitizeThrongletsExport(event));
  const nextState = updateExportState(state, deduped.map((event) => event.key), now);

  return { state: nextState, exports };
}

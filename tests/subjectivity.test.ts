import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeSubjectivityKernel, buildSubjectivityContext } from "../src/subjectivity.js";
import type { PsycheState } from "../src/types.js";
import {
  DEFAULT_DRIVES, DEFAULT_RELATIONSHIP, DEFAULT_LEARNING_STATE,
  DEFAULT_METACOGNITIVE_STATE, DEFAULT_PERSONHOOD_STATE,
} from "../src/types.js";

function makeState(overrides: Partial<PsycheState> = {}): PsycheState {
  const now = new Date().toISOString();
  return {
    version: 9,
    mbti: "INFJ",
    baseline: { DA: 55, HT: 60, CORT: 35, OT: 60, NE: 45, END: 50 },
    current: { DA: 55, HT: 60, CORT: 35, OT: 60, NE: 45, END: 50 },
    drives: { ...DEFAULT_DRIVES },
    updatedAt: now,
    relationships: { _default: { ...DEFAULT_RELATIONSHIP } },
    empathyLog: null,
    selfModel: { values: [], preferences: [], boundaries: [], currentInterests: [] },
    emotionalHistory: [],
    agreementStreak: 0,
    lastDisagreement: null,
    learning: { ...DEFAULT_LEARNING_STATE },
    metacognition: { ...DEFAULT_METACOGNITIVE_STATE },
    personhood: { ...DEFAULT_PERSONHOOD_STATE },
    meta: { agentName: "test", createdAt: now, totalInteractions: 3, locale: "zh", mode: "natural" },
    autonomicState: "ventral-vagal",
    ...overrides,
  };
}

describe("computeSubjectivityKernel", () => {
  it("returns bounded continuous dimensions", () => {
    const kernel = computeSubjectivityKernel(makeState());
    assert.ok(kernel.vitality >= 0 && kernel.vitality <= 1);
    assert.ok(kernel.tension >= 0 && kernel.tension <= 1);
    assert.ok(kernel.warmth >= 0 && kernel.warmth <= 1);
    assert.ok(kernel.guard >= 0 && kernel.guard <= 1);
  });

  it("detects guarded threat-oriented state under high stress", () => {
    const kernel = computeSubjectivityKernel(makeState({
      current: { DA: 30, HT: 35, CORT: 92, OT: 30, NE: 75, END: 25 },
      drives: { survival: 25, safety: 20, connection: 35, esteem: 40, curiosity: 45 },
      autonomicState: "sympathetic",
    }));
    assert.equal(kernel.attentionAnchor, "threat");
    assert.equal(kernel.boundaryMode, "confirm-first");
    assert.ok(["guarded", "strained"].includes(kernel.pressureMode));
  });

  it("detects warm socially open state when trust and oxytocin are high", () => {
    const kernel = computeSubjectivityKernel(makeState({
      current: { DA: 78, HT: 72, CORT: 20, OT: 90, NE: 62, END: 66 },
      relationships: { _default: { trust: 88, intimacy: 78, phase: "close" } },
      drives: { survival: 80, safety: 78, connection: 84, esteem: 74, curiosity: 72 },
    }));
    assert.equal(kernel.socialDistance, "warm");
    assert.ok(["bond", "feeling"].includes(kernel.attentionAnchor));
    assert.notEqual(kernel.boundaryMode, "confirm-first");
  });
});

describe("buildSubjectivityContext", () => {
  it("renders concise Chinese context", () => {
    const ctx = buildSubjectivityContext(computeSubjectivityKernel(makeState()), "zh");
    assert.ok(ctx.startsWith("[主观内核]"), `got: ${ctx}`);
    assert.ok(ctx.length < 80, `expected concise subjectivity context, got ${ctx.length}`);
  });

  it("includes confirmation language when boundary mode is confirm-first", () => {
    const kernel = computeSubjectivityKernel(makeState({
      current: { DA: 28, HT: 32, CORT: 90, OT: 25, NE: 70, END: 20 },
      drives: { survival: 18, safety: 20, connection: 30, esteem: 35, curiosity: 40 },
      autonomicState: "dorsal-vagal",
    }));
    const ctx = buildSubjectivityContext(kernel, "zh");
    assert.ok(ctx.includes("先确认"), `got: ${ctx}`);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeSnapshotIntensity,
  computeSnapshotValence,
  consolidateHistory,
  retrieveRelatedMemories,
  pushSnapshot,
} from "../src/psyche-file.js";
import type { ChemicalState, ChemicalSnapshot, PsycheState } from "../src/types.js";
import { DEFAULT_DRIVES, DEFAULT_LEARNING_STATE, DEFAULT_METACOGNITIVE_STATE, DEFAULT_PERSONHOOD_STATE, DEFAULT_RELATIONSHIP } from "../src/types.js";

// ── Helpers ──────────────────────────────────────────────────

function makeChem(overrides: Partial<ChemicalState> = {}): ChemicalState {
  return { DA: 50, HT: 50, CORT: 50, OT: 50, NE: 50, END: 50, ...overrides };
}

function makeSnapshot(overrides: Partial<ChemicalSnapshot> = {}): ChemicalSnapshot {
  return {
    chemistry: makeChem(),
    stimulus: null,
    dominantEmotion: null,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function makeState(overrides: Partial<PsycheState> = {}): PsycheState {
  const baseline = makeChem();
  return {
    version: 8,
    mbti: "INFJ",
    baseline,
    current: makeChem(),
    drives: { ...DEFAULT_DRIVES },
    updatedAt: new Date().toISOString(),
    relationships: { _default: { ...DEFAULT_RELATIONSHIP } },
    empathyLog: null,
    selfModel: { values: [], preferences: [], boundaries: [], currentInterests: [] },
    emotionalHistory: [],
    agreementStreak: 0,
    lastDisagreement: null,
    learning: { ...DEFAULT_LEARNING_STATE },
    metacognition: { ...DEFAULT_METACOGNITIVE_STATE },
    personhood: { ...DEFAULT_PERSONHOOD_STATE },
    meta: { agentName: "test", createdAt: new Date().toISOString(), totalInteractions: 0, locale: "zh" },
    ...overrides,
  } as PsycheState;
}

// ── computeSnapshotIntensity ─────────────────────────────────

describe("computeSnapshotIntensity", () => {
  it("chemistry at baseline → intensity 0", () => {
    const baseline = makeChem();
    assert.equal(computeSnapshotIntensity(baseline, baseline), 0);
  });

  it("extreme deviation → high intensity", () => {
    const current = makeChem({ DA: 100, HT: 0, CORT: 100, OT: 0, NE: 100, END: 0 });
    const baseline = makeChem();
    const intensity = computeSnapshotIntensity(current, baseline);
    assert.ok(intensity > 0.4, `expected > 0.4, got ${intensity}`);
  });

  it("moderate deviation → moderate intensity", () => {
    const current = makeChem({ DA: 70, CORT: 30 });
    const baseline = makeChem();
    const intensity = computeSnapshotIntensity(current, baseline);
    assert.ok(intensity > 0.05 && intensity < 0.3, `expected 0.05-0.3, got ${intensity}`);
  });

  it("returns 0-1 range", () => {
    const extremes = [
      makeChem({ DA: 0, HT: 0, CORT: 0, OT: 0, NE: 0, END: 0 }),
      makeChem({ DA: 100, HT: 100, CORT: 100, OT: 100, NE: 100, END: 100 }),
    ];
    for (const chem of extremes) {
      const v = computeSnapshotIntensity(chem, makeChem());
      assert.ok(v >= 0 && v <= 1, `expected 0-1, got ${v}`);
    }
  });

  it("symmetric: deviation above or below baseline gives same intensity", () => {
    const baseline = makeChem();
    const high = computeSnapshotIntensity(makeChem({ DA: 80 }), baseline);
    const low = computeSnapshotIntensity(makeChem({ DA: 20 }), baseline);
    assert.equal(high, low);
  });
});

// ── computeSnapshotValence ───────────────────────────────────

describe("computeSnapshotValence", () => {
  it("balanced chemistry → valence near 0", () => {
    const v = computeSnapshotValence(makeChem());
    assert.ok(Math.abs(v) < 0.1, `expected near 0, got ${v}`);
  });

  it("high DA + HT + OT + END, low CORT → positive valence", () => {
    const v = computeSnapshotValence(makeChem({ DA: 90, HT: 80, OT: 80, END: 80, CORT: 20 }));
    assert.ok(v > 0.3, `expected > 0.3, got ${v}`);
  });

  it("high CORT + NE, low everything else → negative valence", () => {
    const v = computeSnapshotValence(makeChem({ CORT: 90, NE: 80, DA: 20, HT: 20, OT: 20, END: 20 }));
    assert.ok(v < -0.2, `expected < -0.2, got ${v}`);
  });

  it("always in [-1, 1]", () => {
    const extremes = [
      makeChem({ DA: 100, HT: 100, OT: 100, END: 100, CORT: 0, NE: 0 }),
      makeChem({ DA: 0, HT: 0, OT: 0, END: 0, CORT: 100, NE: 100 }),
    ];
    for (const chem of extremes) {
      const v = computeSnapshotValence(chem);
      assert.ok(v >= -1 && v <= 1, `expected -1 to 1, got ${v}`);
    }
  });
});

// ── pushSnapshot (P11-enhanced) ──────────────────────────────

describe("pushSnapshot (P11: intensity enrichment)", () => {
  it("near-baseline snapshot is stored with low intensity", () => {
    const state = makeState({ current: makeChem() }); // same as baseline
    const result = pushSnapshot(state, "casual");
    assert.equal(result.emotionalHistory.length, 1);
    assert.ok(result.emotionalHistory[0].intensity !== undefined);
    assert.ok(result.emotionalHistory[0].intensity! < 0.05);
  });

  it("high deviation snapshot is stored with high intensity", () => {
    const state = makeState({ current: makeChem({ DA: 95, NE: 90, CORT: 10, HT: 80 }) });
    const result = pushSnapshot(state, "praise");
    assert.ok(result.emotionalHistory.length > 0);
    assert.ok(result.emotionalHistory[0].intensity! > 0.2);
  });

  it("stored snapshot has intensity and valence fields", () => {
    const state = makeState({ current: makeChem({ DA: 90, NE: 85, CORT: 20, END: 80 }) });
    const result = pushSnapshot(state, "praise");
    const snap = result.emotionalHistory[0];
    assert.ok(snap.intensity !== undefined, "should have intensity");
    assert.ok(snap.valence !== undefined, "should have valence");
    assert.ok(snap.intensity! > 0);
  });

  it("consolidateHistory filters low intensity during session end", () => {
    const snaps: ChemicalSnapshot[] = [
      makeSnapshot({ intensity: 0.05, timestamp: "2024-01-01T00:00:00Z" }),
      makeSnapshot({ intensity: 0.8, timestamp: "2024-01-01T01:00:00Z" }),
      makeSnapshot({ intensity: 0.03, timestamp: "2024-01-01T02:00:00Z" }),
    ];
    // When consolidated to limit 2, low intensity ones should be dropped first
    const result = consolidateHistory(snaps, 2);
    assert.equal(result.length, 2);
    assert.ok(result.some((s) => s.intensity === 0.8));
  });
});

// ── consolidateHistory ───────────────────────────────────────

describe("consolidateHistory", () => {
  it("empty input → empty output", () => {
    assert.deepStrictEqual(consolidateHistory([]), []);
  });

  it("within limits → returns all with core marking", () => {
    const snaps = [
      makeSnapshot({ intensity: 0.3, timestamp: "2024-01-01T00:00:00Z" }),
      makeSnapshot({ intensity: 0.7, timestamp: "2024-01-01T01:00:00Z" }),
    ];
    const result = consolidateHistory(snaps, 10);
    assert.equal(result.length, 2);
    assert.equal(result[1].isCoreMemory, true); // intensity 0.7 >= 0.6
    assert.ok(!result[0].isCoreMemory); // intensity 0.3 < 0.6
  });

  it("marks intensity >= 0.6 as core memory", () => {
    const snap = makeSnapshot({ intensity: 0.65 });
    const [result] = consolidateHistory([snap], 10);
    assert.equal(result.isCoreMemory, true);
  });

  it("preserves existing core memory flag", () => {
    const snap = makeSnapshot({ intensity: 0.3, isCoreMemory: true });
    const [result] = consolidateHistory([snap], 10);
    assert.equal(result.isCoreMemory, true);
  });

  it("trims to maxEntries, keeping core memories first", () => {
    const snaps = [
      makeSnapshot({ intensity: 0.2, timestamp: "2024-01-01T00:00:00Z" }),
      makeSnapshot({ intensity: 0.8, isCoreMemory: true, timestamp: "2024-01-01T01:00:00Z" }),
      makeSnapshot({ intensity: 0.3, timestamp: "2024-01-01T02:00:00Z" }),
      makeSnapshot({ intensity: 0.1, timestamp: "2024-01-01T03:00:00Z" }),
    ];
    const result = consolidateHistory(snaps, 2);
    assert.equal(result.length, 2);
    // Core memory (0.8) should be kept
    assert.ok(result.some((s) => s.intensity === 0.8));
    // Highest non-core (0.3) should fill remaining slot
    assert.ok(result.some((s) => s.intensity === 0.3));
  });

  it("limits core memories to 5", () => {
    const snaps = Array.from({ length: 8 }, (_, i) =>
      makeSnapshot({
        intensity: 0.9 - i * 0.01,
        isCoreMemory: true,
        timestamp: `2024-01-01T0${i}:00:00Z`,
      }),
    );
    const result = consolidateHistory(snaps, 10);
    const coreCount = result.filter((s) => s.isCoreMemory).length;
    assert.ok(coreCount <= 5, `expected <= 5 core memories, got ${coreCount}`);
  });

  it("returns snapshots in chronological order", () => {
    const snaps = [
      makeSnapshot({ intensity: 0.5, timestamp: "2024-01-01T03:00:00Z" }),
      makeSnapshot({ intensity: 0.8, timestamp: "2024-01-01T01:00:00Z" }),
      makeSnapshot({ intensity: 0.3, timestamp: "2024-01-01T02:00:00Z" }),
    ];
    const result = consolidateHistory(snaps, 10);
    for (let i = 1; i < result.length; i++) {
      assert.ok(
        new Date(result[i].timestamp) >= new Date(result[i - 1].timestamp),
        "should be chronological",
      );
    }
  });
});

// ── retrieveRelatedMemories ──────────────────────────────────

describe("retrieveRelatedMemories", () => {
  it("empty history → empty result", () => {
    assert.deepStrictEqual(retrieveRelatedMemories([], makeChem(), null), []);
  });

  it("returns most chemically similar memories first", () => {
    const history = [
      makeSnapshot({ chemistry: makeChem({ DA: 90, NE: 80 }) }),
      makeSnapshot({ chemistry: makeChem({ DA: 50, NE: 50 }) }), // closest to query
      makeSnapshot({ chemistry: makeChem({ DA: 10, NE: 10 }) }),
    ];
    const query = makeChem({ DA: 55, NE: 55 });
    const result = retrieveRelatedMemories(history, query, null, 2);
    assert.equal(result.length, 2);
    // First result should be closest to query
    assert.equal(result[0].chemistry.DA, 50);
  });

  it("stimulus match gives bonus", () => {
    const history = [
      makeSnapshot({ chemistry: makeChem({ DA: 60 }), stimulus: "praise" }),
      makeSnapshot({ chemistry: makeChem({ DA: 55 }), stimulus: "criticism" }),
    ];
    // DA=55 is closer, but praise stimulus match should boost DA=60
    const result = retrieveRelatedMemories(history, makeChem({ DA: 57 }), "praise", 1);
    assert.equal(result[0].stimulus, "praise");
  });

  it("core memory gives bonus", () => {
    const history = [
      makeSnapshot({ chemistry: makeChem({ DA: 60 }), isCoreMemory: true }),
      makeSnapshot({ chemistry: makeChem({ DA: 58 }) }),
    ];
    const result = retrieveRelatedMemories(history, makeChem({ DA: 59 }), null, 1);
    assert.equal(result[0].isCoreMemory, true);
  });

  it("respects limit parameter", () => {
    const history = Array.from({ length: 10 }, () => makeSnapshot());
    const result = retrieveRelatedMemories(history, makeChem(), null, 3);
    assert.equal(result.length, 3);
  });
});
